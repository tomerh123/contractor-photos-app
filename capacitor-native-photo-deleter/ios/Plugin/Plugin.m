#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativePhotoDeleterPlugin, "NativePhotoDeleter",
    CAP_PLUGIN_METHOD(deletePhotos, CAPPluginReturnPromise);
)
