<?php
/**
 * Shopware 5
 * Copyright (c) shopware AG
 *
 * According to our dual licensing model, this program can be used either
 * under the terms of the GNU Affero General Public License, version 3,
 * or under a proprietary license.
 *
 * The texts of the GNU Affero General Public License with an additional
 * permission and of our proprietary license can be found at and
 * in the LICENSE file you have received along with this program.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * "Shopware" is a registered trademark of shopware AG.
 * The licensing of the program under the AGPLv3 does not imply a
 * trademark license. Therefore any rights, title and interest in
 * our trademarks remain entirely with us.
 */

error_reporting(E_ALL);
ini_set('display_errors', true);

const BUFFER_SEPARATOR = ';';

$request = $_REQUEST;
$host = $_SERVER['HTTP_HOST'] . preg_replace('/\/\?{1}[a-zA-Z=&1-9]*$/', '', $_SERVER['REQUEST_URI']);
$file = __DIR__ . '/shopware.zip';

$scheme = 'http';

if (isset($_SERVER['REQUEST_SCHEME'])) {
    $scheme = $_SERVER['REQUEST_SCHEME'];
} elseif (array_key_exists('HTTPS', $_SERVER) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '') {
    $scheme = 'https';
}

if (array_key_exists('checkRequirements', $request)) {

    if (!function_exists('curl_init')) {
        throw new \RuntimeException('PHP Extension "curl" is required to download a file.');
    }

    if (!class_exists('ZipArchive')) {
        throw new \RuntimeException('PHP Extension "Zip and libzip" is required to unpack a file.');
    }

    if (!is_writable(__DIR__)) {
        throw new \RuntimeException(sprintf('The directory "%s" is not writable.', __DIR__));
    }

    if (file_exists($file)) {
        unlink($file);
    }

    echo 'ready';
    exit();
}

if (array_key_exists('getVersionData', $request)) {
    $parameters = ['major' => 6];

    if (isset($_GET['channel'])) {
        $parameters['channel'] = $_GET['channel'];
    }

    if (isset($_GET['code'])) {
        $parameters['code'] = $_GET['code'];
    }

    $latestVersionUrl = 'https://update-api.shopware.com/v1/releases/install?' . http_build_query($parameters);
    $data = json_decode(file_get_contents($latestVersionUrl), true);

    if (!is_array($data)) {
        throw new \RuntimeException('Could not load latest version information from server');
    }

    $chosenVersion = $data[0];

    if (isset($_GET['version'])) {
        $found = false;

        foreach ($data as $release) {
            if ($release['version'] === $_GET['version']) {
                $chosenVersion = $release;
                $found = true;
            }
        }

        if (!$found) {
            throw new \RuntimeException('Cannot find matching release');
        }
    }

    $version = new Version($chosenVersion);
    echo json_encode($version);
    exit();
}

if (array_key_exists('download', $request)) {
    $url = $request['url'];
    $totalSize = $request['totalSize'];
    $downloader = new Downloader($url, $file, $totalSize);
    $downloader->download();
    exit();
}

if (array_key_exists('compare', $request)) {
    $sha1 = $request['sha1'];
    $localSha1 = sha1_file($file);

    if ($sha1 === $localSha1) {
        echo 'ready';
        exit();
    }

    throw new Exception('The downloaded file does not match the original');
}

if (array_key_exists('fileCount', $request)) {
    $source = new ZipArchive();
    $source->open($file);
    echo $source->numFiles;
    exit();
}

if (array_key_exists('unzip', $request)) {
    $step = $request['step'];
    $unpack = new Unpack($file, __DIR__, $step);
    $index = $unpack->unpack();

    if ($index === 'ready') {
        $filePermissionChanger = new FilePermissionChanger([
            ['chmod' => 0775, 'filePath' => __DIR__ . '/bin/console'],
            ['chmod' => 0775, 'filePath' => __DIR__ . '/var/cache/clear_cache.sh'],
        ]);
        $filePermissionChanger->changePermissions();
    }

    echo $index;
    exit();
}

if (array_key_exists('deleteSelf', $request)) {
    unlink(__FILE__);
    exit();
}

class Version
{
    /** @var string */
    public $version;

    /** @var string */
    public $uri;

    /** @var string */
    public $size;

    /** @var string */
    public $sha1;

    /**
     * @param array $versionData
     *
     * @throws \RuntimeException
     */
    public function __construct(array $versionData)
    {
        if (!array_key_exists('version', $versionData)) {
            throw new \RuntimeException('Could not get "version" from version data');
        }
        if (!array_key_exists('uri', $versionData)) {
            throw new \RuntimeException('Could not get "uri" from version data');
        }
        if (!array_key_exists('size', $versionData)) {
            throw new \RuntimeException('Could not get "size" from version data');
        }
        if (!array_key_exists('sha1', $versionData)) {
            throw new \RuntimeException('Could not get "sha1" from version data');
        }

        $this->version = $versionData['version'];
        $this->uri = $versionData['uri'];
        $this->size = $versionData['size'];
        $this->sha1 = $versionData['sha1'];
    }
}

class Downloader
{
    /** @var string */
    private $url;

    /** @var string */
    private $file;

    /** @var int */
    private $totalSize;

    /** @var int */
    private $stepSize = 1000000;

    /**
     * @param string $url
     * @param string $file
     * @param int $totalSize
     */
    public function __construct($url, $file, $totalSize)
    {
        $this->url = $url;
        $this->file = $file;
        $this->totalSize = $totalSize;
    }

    /**
     * Downloads the shopware.zip
     *
     * @throws \RuntimeException
     */
    public function download()
    {
        if (!$fileStream = fopen($this->file, 'ab+')) {
            throw new \RuntimeException('Could not open ' . $this->file);
        }

        if (filesize($this->file) >= $this->totalSize) {
            fclose($fileStream);
            echo 'ready';
            return;
        }

        $range = filesize($this->file) . '-' . (filesize($this->file) + $this->stepSize);

        $resource = curl_init();
        curl_setopt($resource, CURLOPT_URL, $this->url);
        curl_setopt($resource, CURLOPT_RANGE, $range);
        curl_setopt($resource, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($resource, CURLOPT_NOPROGRESS, false);
        curl_setopt($resource, CURLOPT_HEADER, 0);
        curl_setopt($resource, CURLOPT_FILE, $fileStream);
        curl_setopt($resource, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
        curl_exec($resource);
        curl_close($resource);

        fclose($fileStream);

        echo filesize($this->file);
    }
}

class Unpack
{
    /** @var string */
    private $directory;

    /** @var string */
    private $file;

    /** @var int */
    private $index;

    /** @var int */
    private $stepSize = 500;

    /**
     * @param string $file
     * @param string $directory
     * @param int $currentIndex
     *
     * @throws \RuntimeException
     */
    public function __construct($file, $directory, $currentIndex)
    {
        $this->index = 0;
        $this->file = $file;
        $this->directory = $directory . '/';
        $this->index = $currentIndex;

        if (!file_exists($this->file)) {
            throw new \RuntimeException(sprintf('The file: "%s" does not exists.', $this->file));
        }
    }

    /**
     * Unpacks the shopware.zip file
     *
     * @throws \RuntimeException
     *
     * @return int|string
     */
    public function unpack()
    {
        $zipFile = new ZipArchive();
        $zipFile->open($this->file);

        $next = $this->index + $this->stepSize;

        while ($this->index < $next) {
            if ($this->index >= $zipFile->numFiles) {
                $zipFile->close();
                $this->deleteFile($this->file);
                $this->deleteFile($this->directory . '/index.php');
                return 'ready';
            }

            $zipFile->extractTo($this->directory, $zipFile->getNameIndex($this->index));
            $this->index++;
        }

        $zipFile->close();

        return $this->index;
    }

    /**
     * @param string $file
     * @throws \RuntimeException
     */
    private function deleteFile($file)
    {
        if (file_exists($file)) {
            unlink($file);
        }

        if (file_exists($file)) {
            throw new \RuntimeException(sprintf('The file "%s" could not deleted. ', $file));
        }
    }
}

class FilePermissionChanger
{
    /**
     * Format:
     * [
     *      ['chmod' => 0755, 'filePath' => '/path/to/some/file'],
     * ]
     *
     * @var array
     */
    private $filePermissions;

    /**
     * @param array
     */
    public function __construct(array $filePermissions)
    {
        $this->filePermissions = $filePermissions;
    }

    /**
     * Performs the chmod command on all permission arrays previously provided.
     */
    public function changePermissions()
    {
        foreach ($this->filePermissions as $filePermission) {
            if (array_key_exists('filePath', $filePermission) &&
                array_key_exists('chmod', $filePermission) &&
                is_writable($filePermission['filePath'])) {
                chmod($filePermission['filePath'], $filePermission['chmod']);
            }
        }
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <meta name="robots" content="noindex, nofollow"/>
    <title>Shopware 1-File Installer</title>
    <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAkUExURUxpcRCf/xCf/xCf/xCf/xCf/xCf/xCf/xCf/xCf/xCf/xCf/4y/WxEAAAALdFJOUwDa7qM5imsZKL9Udzu63QAAAPZJREFUKM9jYACBNkPtTcIZDHDgLL0bCDaawPil2rvBYFM4hM8yezcU7HQACziCOZpmWauWLQArABmwaVoD3MRKkPwshA0M0UD+5gIEnwVkRQCSAmaQ6UgKGBqBArtADI6loSkgiWyggDhIIBFqlzVQwADI5wI7V4yBQRpqJivEsRYM2qgCGxl2QwVYoD4EC0wAGZoEFQBJSIBdaAQOArCh2yBuDgSbAbJ2I8Sr7Iu1d28GO2y3OdTZrdLbwE5H+LbMAuy53bunoHl/96YI1AACmhuCGoRANbNg5oADGQREHaAijrBoUXZAjygtHFEJj2yERcjJAQB8X6w8eTgurAAAAFd6VFh0UmF3IHByb2ZpbGUgdHlwZSBpcHRjAAB4nOPyDAhxVigoyk/LzEnlUgADIwsuYwsTIxNLkxQDEyBEgDTDZAMjs1Qgy9jUyMTMxBzEB8uASKBKLgDqFxF08kI1lQAAAABJRU5ErkJggg=="/>

    <style rel="stylesheet">
        <!-- STYLE REPLACEMENT -->
    </style>
</head>
<body>
<div class="error--message-container">
    <div class="error--message is--hidden"></div>
</div>
<div class="container">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 390" width="390" height="390">
        <g fill="#f1f1f1" stroke-width="3" stroke="#fff" fill-opacity="0" transform="scale(0.5), translate(180, 180)"
           class="group--logo">
            <path class="logo--left"
                  d="M291.41 325.43c-15.88-11.96-39.283-21.035-64.067-30.646-29.494-11.437-62.923-24.4-88.023-44.373-28.436-22.63-42.26-51.185-42.26-87.304 0-32.396 13.45-60.105 38.895-80.132C164.487 60.516 207.7 48.647 260.92 48.647c14.704 0 28.76.905 41.777 2.693 1.15.153 2.256-.47 2.73-1.496.49-1.052.238-2.28-.624-3.057C271.25 16.62 227.9.004 182.736.004c-48.812 0-94.703 19.007-129.217 53.52C19.003 88.034 0 133.918 0 182.724c0 48.812 19.007 94.7 53.52 129.206 34.51 34.506 80.4 53.51 129.216 53.51 39.437 0 77.01-12.38 108.656-35.803.663-.49 1.06-1.276 1.063-2.1.004-.824-.388-1.612-1.046-2.106"/>
            <path class="logo--right"
                  d="M364.672 165.84c-.06-.696-.4-1.35-.94-1.795-38.132-31.65-68.972-44.558-106.447-44.558-19.998 0-35.33 4.01-45.57 11.92C202.848 138.26 198.16 147.8 198.16 159c0 31.384 38.357 45.688 82.77 62.25 22.888 8.537 46.556 17.363 68.284 29.417.388.217.828.33 1.272.33.306 0 .606-.053.89-.155.714-.257 1.28-.81 1.557-1.516 8.297-21.26 12.504-43.67 12.504-66.603 0-5.387-.257-11.068-.764-16.883"/>
        </g>

        <g class="group--loading" transform="rotate(270), translate(-360, 0)">
            <circle cx="180" cy="180" r="110" class="background-ring"></circle>
            <circle cx="180" cy="180" r="110" class="loader-ring"></circle>
        </g>

        <polyline transform="translate(55, 50), scale(7)" class="tick" points="11.6,20 15.9,24.2 26.4,13.8 "/>
    </svg>
</div>

<script>
    uri = '<?php echo $scheme; ?>://<?php echo $host; ?>';
    baseFileName = '/<?php echo basename(__FILE__); ?>'
    bufferSeparator = '<?php echo BUFFER_SEPARATOR; ?>';
</script>
<script>
    <!-- JS REPLACEMENT -->
</script>
</body>
</html>