# Android Build Guidelines

When building for Android with Capacitor and GitHub Actions, be mindful of Gradle Wrapper validation and AndroidX versions to avoid build errors.

## 1. Gradle Wrapper Validation Error (`validate-wrappers`)
If you see the error:
`Error: At least one Gradle Wrapper Jar failed validation!`
You must:
1. Delete the corrupted `gradle-wrapper.jar` before setup: `rm -f android/gradle/wrapper/gradle-wrapper.jar`
2. Update the Action to v4 and disable wrapper validation:
```yaml
      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.12.1'
          cache-disabled: true
          validate-wrappers: false
```
3. Generate a fresh wrapper afterward using the local `gradle` command:
```yaml
      - name: Generate Fresh Gradle Wrapper
        run: |
          cd android
          gradle wrapper --gradle-version 8.12.1
          chmod +x gradlew
```

## 2. Compile SDK vs AndroidX Library Versions
If you see AAPT errors like:
`Dependency 'androidx.activity:activity:1.11.0' requires libraries and applications that depend on it to compile against version 36 or later`
This happens when Capacitor's default `compileSdkVersion` (e.g. 35) is lower than what newer `androidx` libraries require (e.g. 36).

**Solution**: Do not blindly upgrade `androidx` variables in `android/variables.gradle` to the latest versions if they require a higher `compileSdkVersion`.
Use compatible versions, for example:
```gradle
    compileSdkVersion = 35
    targetSdkVersion = 35
    androidxActivityVersion = '1.9.3'
    androidxAppCompatVersion = '1.7.0'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.13.1'
    androidxFragmentVersion = '1.8.5'
```
