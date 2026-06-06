// Expo Config Plugin — adds a Share Extension so Dindin appears in the iOS share sheet
// when sharing from Instagram, Pinterest, or any other app.
//
// The extension saves the shared URL to App Group UserDefaults.
// The main app reads it on next launch via the DindinSharedStorage native module.

const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const APP_GROUP = 'group.in.istudio.dindin';
const EXTENSION_NAME = 'DindinShare';

// ─── Share Extension Swift code ────────────────────────────────
const SHARE_VIEW_CONTROLLER = `
import UIKit
import UniformTypeIdentifiers
import MobileCoreServices

class ShareViewController: UIViewController {

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    extractAndSave()
  }

  private func extractAndSave() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { finish(); return }

    for item in items {
      for provider in (item.attachments ?? []) {
        let urlType = UTType.url.identifier
        let textType = UTType.plainText.identifier

        if provider.hasItemConformingToTypeIdentifier(urlType) {
          provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] data, _ in
            if let url = data as? URL { self?.save(url.absoluteString) }
            else { self?.finish() }
          }
          return
        } else if provider.hasItemConformingToTypeIdentifier(textType) {
          provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] data, _ in
            if let text = data as? String { self?.save(text) }
            else { self?.finish() }
          }
          return
        }
      }
    }
    finish()
  }

  private func save(_ urlString: String) {
    if let defaults = UserDefaults(suiteName: "${APP_GROUP}") {
      var pending = defaults.stringArray(forKey: "dindin_pending_urls") ?? []
      if !pending.contains(urlString) { pending.append(urlString) }
      defaults.set(pending, forKey: "dindin_pending_urls")
      defaults.synchronize()
    }
    DispatchQueue.main.async { self.finish() }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }
}
`.trim();

// ─── Share Extension Info.plist ────────────────────────────────
const EXTENSION_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key><string>Save to Dindin</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>NSExtensionActivationRule</key>
      <dict>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
        <key>NSExtensionActivationSupportsText</key><true/>
      </dict>
    </dict>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
  </dict>
</dict>
</plist>`.trim();

// ─── Share Extension entitlements ──────────────────────────────
const EXTENSION_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>`.trim();

// ─── Native module — reads App Group UserDefaults from JS ───────
const SHARED_STORAGE_SWIFT = `
import Foundation

@objc(DindinSharedStorage)
class DindinSharedStorage: NSObject {

  @objc func getPendingUrls(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults(suiteName: "${APP_GROUP}")
    let urls = defaults?.stringArray(forKey: "dindin_pending_urls") ?? []
    resolve(urls)
  }

  @objc func clearPendingUrls(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults(suiteName: "${APP_GROUP}")
    defaults?.removeObject(forKey: "dindin_pending_urls")
    defaults?.synchronize()
    resolve(nil)
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
`.trim();

const SHARED_STORAGE_OBJC = `
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DindinSharedStorage, NSObject)
RCT_EXTERN_METHOD(
  getPendingUrls:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)
RCT_EXTERN_METHOD(
  clearPendingUrls:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)
@end
`.trim();

// ─── Plugin entry point ────────────────────────────────────────
module.exports = function withShareExtension(config) {
  // 1. Add App Group to main app entitlements
  config = withEntitlementsPlist(config, (props) => {
    const groups = props.modResults['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    props.modResults['com.apple.security.application-groups'] = groups;
    return props;
  });

  // 2. Write native files + add extension target to Xcode project
  config = withXcodeProject(config, (props) => {
    const iosRoot = props.modRequest.platformProjectRoot;
    const appName = props.modRequest.projectName ?? 'dindin';

    // Write Share Extension files
    const extDir = path.join(iosRoot, EXTENSION_NAME);
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(path.join(extDir, 'ShareViewController.swift'), SHARE_VIEW_CONTROLLER);
    fs.writeFileSync(path.join(extDir, 'Info.plist'), EXTENSION_INFO_PLIST);
    fs.writeFileSync(path.join(extDir, `${EXTENSION_NAME}.entitlements`), EXTENSION_ENTITLEMENTS);

    // Write native module files into main app
    const mainDir = path.join(iosRoot, appName);
    fs.writeFileSync(path.join(mainDir, 'DindinSharedStorage.swift'), SHARED_STORAGE_SWIFT);
    fs.writeFileSync(path.join(mainDir, 'DindinSharedStorageBridge.m'), SHARED_STORAGE_OBJC);

    const project = props.modResults;
    const mainBundleId = config.ios?.bundleIdentifier ?? 'in.istudio.dindin';
    const extBundleId = `${mainBundleId}.DindinShare`;

    // Add extension target (skip if already added)
    const targets = project.pbxNativeTargetSection();
    const alreadyExists = Object.values(targets).some(
      (t) => typeof t === 'object' && t.name === EXTENSION_NAME,
    );

    if (!alreadyExists) {
      const target = project.addTarget(EXTENSION_NAME, 'app_extension', EXTENSION_NAME, extBundleId);
      const targetKey = target.uuid;

      // Add source and resource build phases
      project.addBuildPhase(
        [`${EXTENSION_NAME}/ShareViewController.swift`],
        'PBXSourcesBuildPhase',
        'Sources',
        targetKey,
      );
      project.addBuildPhase(
        [`${EXTENSION_NAME}/Info.plist`],
        'PBXResourcesBuildPhase',
        'Resources',
        targetKey,
      );

      // Configure build settings for the extension target
      const configs = project.pbxXCBuildConfigurationSection();
      for (const [, cfg] of Object.entries(configs)) {
        if (typeof cfg !== 'object' || !cfg.buildSettings) continue;
        const bs = cfg.buildSettings;
        if (bs.PRODUCT_NAME !== `"${EXTENSION_NAME}"` && bs.PRODUCT_NAME !== EXTENSION_NAME) continue;

        Object.assign(bs, {
          SWIFT_VERSION: '5.0',
          PRODUCT_BUNDLE_IDENTIFIER: extBundleId,
          INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
          CODE_SIGN_ENTITLEMENTS: `${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements`,
          MARKETING_VERSION: config.version ?? '1.0.0',
          CURRENT_PROJECT_VERSION: '1',
          TARGETED_DEVICE_FAMILY: '"1,2"',
          IPHONEOS_DEPLOYMENT_TARGET: '15.0',
          SKIP_INSTALL: 'YES',
        });
      }
    }

    // Add native module files to main target
    const mainTarget = project.getFirstTarget();
    if (mainTarget) {
      const mainKey = mainTarget.uuid;
      const existingSources = project.pbxSourcesBuildPhaseObj(mainKey);
      const files = existingSources?.files?.map((f) => f.comment) ?? [];

      if (!files.some((f) => f?.includes('DindinSharedStorage.swift'))) {
        project.addSourceFile('DindinSharedStorage.swift', { target: mainKey }, mainDir);
        project.addSourceFile('DindinSharedStorageBridge.m', { target: mainKey }, mainDir);
      }
    }

    return props;
  });

  return config;
};
