const { withInfoPlist, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withIOSBackupSecurity(config) {
  // Update Info.plist with security settings
  config = withInfoPlist(config, (config) => {
    // Add file protection settings
    config.modResults.UIFileSharingEnabled = false;
    config.modResults.LSSupportsOpeningDocumentsInPlace = false;
    
    // Ensure app uses data protection
    config.modResults.NSFileProtectionComplete = true;
        
    return config;
  });

  // Create native iOS module to exclude sensitive directories from backup
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, "ios");
      
      // Check if iOS directory exists
      if (fs.existsSync(iosPath)) {
        const projectName = config.name || "ReadyNow";
        const appDelegatePath = path.join(iosPath, projectName, "AppDelegate.mm");
        
        if (fs.existsSync(appDelegatePath)) {
          let appDelegateContent = fs.readFileSync(appDelegatePath, "utf8");
          
          // Check if backup exclusion code already exists
          if (!appDelegateContent.includes("excludeFromBackup")) {
            // Add import for file manager
            if (!appDelegateContent.includes("#import <Foundation/Foundation.h>")) {
              appDelegateContent = appDelegateContent.replace(
                '#import "AppDelegate.h"',
                '#import "AppDelegate.h"\n#import <Foundation/Foundation.h>'
              );
            }
            
            // Add backup exclusion method
            const backupExclusionMethod = `
// Security: Exclude sensitive data from iCloud backups
- (void)excludeSensitiveDirectoriesFromBackup {
  NSArray *pathsToExclude = @[
    NSDocumentDirectory,
    NSLibraryDirectory,
    NSCachesDirectory
  ];
  
  NSFileManager *fileManager = [NSFileManager defaultManager];
  
  for (NSNumber *searchPath in pathsToExclude) {
    NSArray *paths = NSSearchPathForDirectoriesInDomains([searchPath unsignedIntegerValue], NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSURL *url = [NSURL fileURLWithPath:documentsDirectory];
    
    NSError *error = nil;
    BOOL success = [url setResourceValue:@YES
                                  forKey:NSURLIsExcludedFromBackupKey
                                   error:&error];
    
    if (!success) {
      NSLog(@"Error excluding %@ from backup: %@", url.lastPathComponent, error.localizedDescription);
    } else {
      NSLog(@"Successfully excluded %@ from backup", url.lastPathComponent);
    }
  }
  
  // Also exclude specific sensitive files if they exist
  NSArray *sensitiveFiles = @[
    @"emergency_plan_encryption_key",
    @"auth_token",
    @"user_info",
    @"emergency_plan_data"
  ];
  
  for (NSString *fileName in sensitiveFiles) {
    NSString *filePath = [documentsDirectory stringByAppendingPathComponent:fileName];
    if ([fileManager fileExistsAtPath:filePath]) {
      NSURL *fileURL = [NSURL fileURLWithPath:filePath];
      [fileURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
    }
  }
}
`;
            
            // Insert the method before @end
            appDelegateContent = appDelegateContent.replace(
              /(@end[\s\S]*$)/,
              backupExclusionMethod + "\n\n$1"
            );
            
            // Call the method in application:didFinishLaunchingWithOptions:
            const methodCall = "\n  // Exclude sensitive data from backups\n  [self excludeSensitiveDirectoriesFromBackup];\n";
            
            // Find the right place to insert (before return YES)
            appDelegateContent = appDelegateContent.replace(
              /(application:.*didFinishLaunchingWithOptions:[\s\S]*?)(return YES;)/,
              `$1${methodCall}\n  $2`
            );
            
            fs.writeFileSync(appDelegatePath, appDelegateContent);
          }
        }
        
        // Create a helper class for Swift/Objective-C interop
        const backupHelperPath = path.join(iosPath, projectName, "BackupSecurityHelper.m");
        const backupHelperHeaderPath = path.join(iosPath, projectName, "BackupSecurityHelper.h");
        
        // Create header file
        const headerContent = `//
//  BackupSecurityHelper.h
//  Security helper to exclude sensitive data from backups
//

#import <Foundation/Foundation.h>

@interface BackupSecurityHelper : NSObject

+ (void)excludeItemAtPath:(NSString *)path fromBackup:(BOOL)exclude;
+ (void)excludeAllSensitiveDataFromBackup;
+ (BOOL)isExcludedFromBackup:(NSString *)path;

@end
`;

        // Create implementation file
        const implementationContent = `//
//  BackupSecurityHelper.m
//  Security helper to exclude sensitive data from backups
//

#import "BackupSecurityHelper.h"

@implementation BackupSecurityHelper

+ (void)excludeItemAtPath:(NSString *)path fromBackup:(BOOL)exclude {
    NSURL *url = [NSURL fileURLWithPath:path];
    NSError *error = nil;
    
    BOOL success = [url setResourceValue:@(exclude)
                                  forKey:NSURLIsExcludedFromBackupKey
                                   error:&error];
    
    if (!success && error) {
        NSLog(@"Error setting backup exclusion for %@: %@", path, error.localizedDescription);
    }
}

+ (void)excludeAllSensitiveDataFromBackup {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    // Get app's document directory
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    
    // Exclude entire documents directory
    [self excludeItemAtPath:documentsDirectory fromBackup:YES];
    
    // Get app's library directory
    paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
    NSString *libraryDirectory = [paths objectAtIndex:0];
    
    // Exclude sensitive subdirectories in Library
    NSArray *sensitiveLibraryPaths = @[
        [libraryDirectory stringByAppendingPathComponent:@"Caches"],
        [libraryDirectory stringByAppendingPathComponent:@"Preferences"]
    ];
    
    for (NSString *path in sensitiveLibraryPaths) {
        if ([fileManager fileExistsAtPath:path]) {
            [self excludeItemAtPath:path fromBackup:YES];
        }
    }
}

+ (BOOL)isExcludedFromBackup:(NSString *)path {
    NSURL *url = [NSURL fileURLWithPath:path];
    NSNumber *isExcluded = nil;
    
    [url getResourceValue:&isExcluded forKey:NSURLIsExcludedFromBackupKey error:nil];
    
    return [isExcluded boolValue];
}

@end
`;
        
        fs.writeFileSync(backupHelperHeaderPath, headerContent);
        fs.writeFileSync(backupHelperPath, implementationContent);
      }
      
      return config;
    },
  ]);

  return config;
}

module.exports = withIOSBackupSecurity; 