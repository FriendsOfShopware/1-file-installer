# A one file installer for Shopware 6

![Install](https://i.imgur.com/sdAXMzV.png)

# Usage

* Download the install.php and upload the file to your webspace
    * `wget -O install.php https://install.fos.gg` (on shell)

* Request the page with /install.php and the installer downloads latest Shopware 6 and unpacks it to the current folder
* After downloading and unpacking it will redirect you to the Install page of Shopware 6

## Specific version or channel

You can add query parameters like `version` or `channel` to the URL to specify a channel or an version

Examples:

- `/install.php?version=6.3.2.1`
- `/install.php?channel=rc` - Downloads the newest RC
