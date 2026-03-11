import Foundation
import Capacitor
import Photos

@objc(NativePhotoDeleterPlugin)
public class NativePhotoDeleterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePhotoDeleterPlugin"
    public let jsName = "NativePhotoDeleter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deletePhotos", returnType: CAPPluginReturnPromise)
    ]

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
}
