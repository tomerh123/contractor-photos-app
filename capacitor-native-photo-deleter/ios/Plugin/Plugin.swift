import Foundation
import Capacitor
import Photos
import PhotosUI

@objc(NativePhotoDeleterPlugin)
public class NativePhotoDeleterPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "NativePhotoDeleterPlugin"
    public let jsName = "NativePhotoDeleter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deletePhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImages", returnType: CAPPluginReturnPromise)
    ]
    
    private var savedCall: CAPPluginCall?

    @objc func deletePhotos(_ call: CAPPluginCall) {
        guard let identifiers = call.getArray("identifiers", String.self) else {
            call.reject("Must provide an array of identifiers to delete")
            return
        }
        
        if identifiers.isEmpty {
            call.resolve()
            return
        }
        
        DispatchQueue.main.async {
            let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: nil)
            
            if fetchResult.count == 0 {
                // Not found, maybe already deleted
                call.resolve()
                return
            }

            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.deleteAssets(fetchResult)
            }) { success, error in
                if success {
                    call.resolve()
                } else if let error = error {
                    call.reject("Failed to delete photos", error.localizedDescription)
                } else {
                    call.reject("Failed to delete photos for unknown reason")
                }
            }
        }
    }
    
    @objc func pickImages(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.savedCall = call
            
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.selectionLimit = 0 // 0 means unlimited
            config.filter = .images
            
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            
            self.bridge?.viewController?.present(picker, animated: true, completion: nil)
        }
    }
    
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true, completion: nil)
        
        guard let call = self.savedCall else { return }
        self.savedCall = nil
        
        if results.isEmpty {
            call.resolve([ "photos": [] ])
            return
        }
        
        var parsedPhotos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        let lock = NSLock()
        
        for result in results {
            // In PHPicker, the assetIdentifier is only returned if we initiated the config with the photo library
            guard let assetIdentifier = result.assetIdentifier else { continue }
            
            dispatchGroup.enter()
            
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: "public.image") { url, error in
                defer { dispatchGroup.leave() }
                
                if let url = url {
                    do {
                        let data = try Data(contentsOf: url)
                        if let image = UIImage(data: data) {
                            
                            // Native Resize Logic (Match JS 1600px Max)
                            let maxDimension: CGFloat = 1600.0
                            var targetSize = image.size
                            
                            if image.size.width > maxDimension || image.size.height > maxDimension {
                                let ratio = min(maxDimension/image.size.width, maxDimension/image.size.height)
                                targetSize = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
                            }
                            
                            UIGraphicsBeginImageContextWithOptions(targetSize, false, 1.0)
                            image.draw(in: CGRect(origin: .zero, size: targetSize))
                            let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
                            UIGraphicsEndImageContext()
                            
                            if let jpegData = resizedImage?.jpegData(compressionQuality: 0.8) {
                                let base64String = jpegData.base64EncodedString()
                                let dataUrl = "data:image/jpeg;base64,\(base64String)"
                                
                                lock.lock()
                                parsedPhotos.append([
                                    "identifier": assetIdentifier,
                                    "dataUrl": dataUrl
                                ])
                                lock.unlock()
                            }
                        }
                    } catch {
                        print("Error reading image file data: \(error)")
                    }
                } else if let error = error {
                    print("Error loading file representation: \(error)")
                }
            }
        }
        
        dispatchGroup.notify(queue: .main) {
            call.resolve([
                "photos": parsedPhotos
            ])
        }
    }
}
