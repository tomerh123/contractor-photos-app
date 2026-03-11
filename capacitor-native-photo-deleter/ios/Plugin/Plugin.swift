import Foundation
import Capacitor
import Photos
import PhotosUI
import AVFoundation

@objc(NativePhotoDeleterPlugin)
public class NativePhotoDeleterPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "NativePhotoDeleterPlugin"
    public let jsName = "NativePhotoDeleter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deletePhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureMedia", returnType: CAPPluginReturnPromise)
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
            config.filter = .any(of: [.images, .videos])
            
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            
            self.bridge?.viewController?.present(picker, animated: true, completion: nil)
        }
    }
    
    @objc func captureMedia(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera not available")
                return
            }
            
            let picker = UIImagePickerController()
            picker.delegate = self
            picker.sourceType = .camera
            picker.mediaTypes = ["public.image", "public.movie"]
            picker.videoQuality = .typeHigh
            
            self.savedCall = call
            self.bridge?.viewController?.present(picker, animated: true, completion: nil)
        }
    }
    
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        picker.dismiss(animated: true, completion: nil)
        guard let call = self.savedCall else { return }
        self.savedCall = nil
        
        guard let mediaType = info[.mediaType] as? String else {
            call.reject("Failed to capture media info")
            return
        }
        
        if mediaType == "public.movie" {
            guard let videoURL = info[.mediaURL] as? URL else {
                call.reject("Failed to capture video URL")
                return
            }
            
            let tempDir = FileManager.default.temporaryDirectory
            let fileName = UUID().uuidString + ".mp4"
            let tempFileURL = tempDir.appendingPathComponent(fileName)
            
            do {
                if FileManager.default.fileExists(atPath: tempFileURL.path) {
                    try FileManager.default.removeItem(at: tempFileURL)
                }
                try FileManager.default.copyItem(at: videoURL, to: tempFileURL)
                
                // Generate Thumbnail natively using AVFoundation
                let asset = AVAsset(url: tempFileURL)
                let imageGenerator = AVAssetImageGenerator(asset: asset)
                imageGenerator.appliesPreferredTrackTransform = true
                var dataUrl: String = ""
                
                do {
                    let cgImage = try imageGenerator.copyCGImage(at: .zero, actualTime: nil)
                    let uiImage = UIImage(cgImage: cgImage)
                    if let jpegData = uiImage.jpegData(compressionQuality: 0.6) {
                        dataUrl = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
                    }
                } catch {
                    print("Error generating video thumbnail: \(error)")
                }
                
                let response: [String: Any] = [
                    "type": "video",
                    "path": tempFileURL.path,
                    "dataUrl": dataUrl
                ]
                call.resolve(response)
            } catch {
                call.reject("Error saving video file", error.localizedDescription)
            }
        } else if mediaType == "public.image" {
            guard let image = info[.originalImage] as? UIImage else {
                call.reject("Failed to capture image")
                return
            }
            
            guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
                call.reject("Failed to process image data")
                return
            }
            
            let dataUrl = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
            
            let response: [String: Any] = [
                "type": "image",
                "dataUrl": dataUrl
            ]
            call.resolve(response)
        } else {
            call.reject("Unsupported media type")
        }
    }
    
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true, completion: nil)
        savedCall?.reject("User cancelled")
        savedCall = nil
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
            
            if result.itemProvider.hasItemConformingToTypeIdentifier("public.movie") {
                result.itemProvider.loadFileRepresentation(forTypeIdentifier: "public.movie") { url, error in
                    defer { dispatchGroup.leave() }
                    
                    if let url = url {
                        let tempDir = FileManager.default.temporaryDirectory
                        let fileName = UUID().uuidString + ".mp4"
                        let tempFileURL = tempDir.appendingPathComponent(fileName)
                        
                        do {
                            if FileManager.default.fileExists(atPath: tempFileURL.path) {
                                try FileManager.default.removeItem(at: tempFileURL)
                            }
                            try FileManager.default.copyItem(at: url, to: tempFileURL)
                            
                            // Generate Thumbnail natively using AVFoundation
                            let asset = AVAsset(url: tempFileURL)
                            let imageGenerator = AVAssetImageGenerator(asset: asset)
                            imageGenerator.appliesPreferredTrackTransform = true
                            
                            var dataUrl: String? = nil
                            
                            do {
                                let cgImage = try imageGenerator.copyCGImage(at: .zero, actualTime: nil)
                                let uiImage = UIImage(cgImage: cgImage)
                                
                                // Compress thumbnail slightly
                                if let jpegData = uiImage.jpegData(compressionQuality: 0.6) {
                                    dataUrl = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
                                }
                            } catch {
                                print("Error generating video thumbnail: \(error)")
                            }
                            
                            lock.lock()
                            parsedPhotos.append([
                                "identifier": assetIdentifier,
                                "mediaType": "video",
                                "path": tempFileURL.path,
                                "dataUrl": dataUrl ?? ""
                            ])
                            lock.unlock()
                            
                        } catch {
                            print("Error processing video file: \(error)")
                        }
                    } else if let error = error {
                        print("Error loading video representation: \(error)")
                    }
                }
            } else {
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
                                        "mediaType": "photo",
                                        "dataUrl": dataUrl
                                    ])
                                    lock.unlock()
                                }
                            }
                        } catch {
                            print("Error reading image file data: \(error)")
                        }
                    } else if let error = error {
                        print("Error loading image representation: \(error)")
                    }
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
