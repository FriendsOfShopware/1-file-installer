function $(sel, parent) {
    parent = parent || document;
    return parent.querySelector(sel);
}

function ready(cb) {
    var fallback = new Fallback('.container', 'fallBackMainContainer');

    if (fallback.isFallbackRequired()) {
        fallback.createFallback();
        new App(uri, bufferSeparator, true);
        return;
    }

    document.addEventListener('DOMContentLoaded', cb, false);
}

function prefixedEvent(el, type, cb) {
    var pfx = ['webkit', 'moz', 'MS', 'o', ''];
    for (var p = 0; p < pfx.length; p++) {
        if (!pfx[p]) type = type.toLowerCase();
        el.addEventListener(pfx[p] + type, cb, false);
    }
}

function Fallback(elementSelector, fallbackClassName) {
    this.fallbackClassName = fallbackClassName;
    this.element = $(elementSelector);
}

Fallback.prototype.createFallback = function() {
    this.element.removeChild($('svg'));
    this.element.appendChild(this.createFallbackElement());
};

Fallback.prototype.isFallbackRequired = function() {
    // Internet Explorer
    var isIE = /*@cc_on!@*/false || !!document.documentMode,
        // Edge
        isEdge = !isIE && !!window.StyleMedia;

    return isIE || isEdge;
};

Fallback.prototype.createFallbackElement = function() {
    var fallback = document.createElement('div');

    fallback.className = this.fallbackClassName;
    fallback.innerHTML = this.getTemplate();

    return fallback;
};

Fallback.prototype.getTemplate = function() {
    return '' +
        '<div class="fallbackLogo">' +
        '   <svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 0 390 390" width="390" height="390" style="margin: 0 auto;">' +
        '      <g fill="#f1f1f1" stroke-width="3" stroke="#fff" fill-opacity="1" transform="scale(0.5), translate(180, 180)">' +
        '          <path d="M291.41 325.43c-15.88-11.96-39.283-21.035-64.067-30.646-29.494-11.437-62.923-24.4-88.023-44.373-28.436-22.63-42.26-51.185-42.26-87.304 0-32.396 13.45-60.105 38.895-80.132C164.487 60.516 207.7 48.647 260.92 48.647c14.704 0 28.76.905 41.777 2.693 1.15.153 2.256-.47 2.73-1.496.49-1.052.238-2.28-.624-3.057C271.25 16.62 227.9.004 182.736.004c-48.812 0-94.703 19.007-129.217 53.52C19.003 88.034 0 133.918 0 182.724c0 48.812 19.007 94.7 53.52 129.206 34.51 34.506 80.4 53.51 129.216 53.51 39.437 0 77.01-12.38 108.656-35.803.663-.49 1.06-1.276 1.063-2.1.004-.824-.388-1.612-1.046-2.106"/>' +
        '          <path d="M364.672 165.84c-.06-.696-.4-1.35-.94-1.795-38.132-31.65-68.972-44.558-106.447-44.558-19.998 0-35.33 4.01-45.57 11.92C202.848 138.26 198.16 147.8 198.16 159c0 31.384 38.357 45.688 82.77 62.25 22.888 8.537 46.556 17.363 68.284 29.417.388.217.828.33 1.272.33.306 0 .606-.053.89-.155.714-.257 1.28-.81 1.557-1.516 8.297-21.26 12.504-43.67 12.504-66.603 0-5.387-.257-11.068-.764-16.883"/>' +
        '      </g>' +
        '   </svg>' +
        '</div>' +
        '<div class="fallbackProgressbar"><div class="fallbackIndicator"></div></div>';
};

/**
 * @param { string } uri
 * @param { string } bufferSeparator
 * @param { boolean } requireFallback
 * @constructor
 */
function App(uri, bufferSeparator, requireFallback) {
    this.hostUrl = uri;
    this.bufferSeperator = bufferSeparator;
    this.requireFallback = requireFallback || false;
    this.init();
}

App.prototype.init = function() {
    let urlWithoutParameters = new URL(this.hostUrl);
    let concatParameter = urlWithoutParameters.search === '' ? '?' : '&';

    urlWithoutParameters.search = '';

    console.log(urlWithoutParameters.toString().replace(baseFileName, '').replace('//', '/') + '/public/recovery/install');

    this.readyResponse = 'ready';
    this.checkRequirementsUrl = this.hostUrl + concatParameter + 'checkRequirements';
    this.getVersionUrl = this.hostUrl + concatParameter + 'getVersionData=1';
    this.downloadUrl = this.hostUrl + concatParameter + 'download=1';
    this.compareUrl = this.hostUrl + concatParameter + 'compare';
    this.fileCountUrl = this.hostUrl + concatParameter + 'fileCount';
    this.unzipUrl = this.hostUrl + concatParameter + 'unzip';
    this.deleteUrl = this.hostUrl + concatParameter + 'deleteSelf';
    this.installUrl = urlWithoutParameters.toString().replace(baseFileName, '') + '/public/recovery/install';
    this.downloadProgressRange = 50;
    this.unpackProgressRange = 40;
    this.compareResultStep = 55;
    this.fileCountStep = 60;
    this.redirectTimeout = 2000;
    this.messageBox = new MessageBox('.error--message');
    this.ajaxHelper = new Ajax(this.messageBox);

    if (this.requireFallback) {
        this.progressbar = new Progressbar(this.getFallbackProgressbarConfig());
    } else {
        this.progressbar = new Progressbar(this.getProgressbarConfig());
    }

    this.checkRequirements();
};

App.prototype.getProgressbarConfig = function() {
    return {
        elementSelector: '.loader-ring',
        baseValue: 700,
        groupLoadingSelector: '.group--loading',
        tickSelector: '.tick',
        fadeClass: 'fadein-fill',
        isFallback: false
    };
};

App.prototype.getFallbackProgressbarConfig = function() {
    return {
        elementSelector: '.fallbackIndicator',
        baseValue: 0,
        groupLoadingSelector: '',
        tickSelector: '',
        fadeClass: '',
        isFallback: true
    };
};

App.prototype.checkRequirements = function() {
    this.ajaxHelper.createRequest(this.checkRequirementsUrl, this.getVersion, this);
    this.ajaxHelper.startRequest();
};

App.prototype.getVersion = function(responseText) {
    if (responseText !== this.readyResponse) {
        this.messageBox.show(responseText);
        return;
    }

    this.ajaxHelper.createRequest(this.getVersionUrl, this.onGetVersion, this);
    this.ajaxHelper.startRequest();

};

/**
 * Sets a object to versionData like:
 * {
 * "version": "5.6.9",
 * "release_date": null,
 * "uri": "http://releases.s3.shopware.com.s3.amazonaws.com/install_5.6.9_be8e9cd9a8f4b7ab6f81c7922e71cbe3c16d78eb.zip",
 * "size": "45485967",
 * "sha1": "be8e9cd9a8f4b7ab6f81c7922e71cbe3c16d78eb",
 * "sha256": "9937cb4f7f3f5570cc75b46f66ecdbdf086def6e62006a370ae662c4e99cbcbc"
 *   }
 *
 * @param { string } responseText
 */
App.prototype.onGetVersion = function(responseText) {
    try {
        this.versionData = JSON.parse(responseText);
    } catch (exception) {
        this.messageBox.show(responseText);
    }

    this.startDownLoad();
};

App.prototype.startDownLoad = function() {
    var url = this.downloadUrl + '&url=' + this.versionData.uri + '&totalSize=' + this.versionData.size;

    this.ajaxHelper.createRequest(url, this.onDownloadProcess, this);
    this.ajaxHelper.startRequest();
};

/**
 * @param { string } responseText
 */
App.prototype.onDownloadProcess = function(responseText) {
    var currentSize;

    if (responseText !== this.readyResponse) {
        currentSize = this.downloadProgressRange / this.versionData.size * responseText;
        this.progressbar.update(currentSize);
        this.startDownLoad();
        return;
    }

    this.onDownloadReady(responseText);
};

/**
 * @param { string } responseText
 */
App.prototype.onDownloadReady = function(responseText) {
    var lines = responseText.split(this.bufferSeperator);

    if (lines[lines.length - 1] === this.readyResponse) {
        this.compareFileSha1();
        return;
    }

    this.messageBox.show(responseText)
};

App.prototype.compareFileSha1 = function() {
    this.ajaxHelper.createRequest(this.compareUrl + '&sha1=' + this.versionData.sha1, this.onGetCompareResult, this);
    this.ajaxHelper.startRequest();
};

/**
 * @param { string } responseText
 */
App.prototype.onGetCompareResult = function(responseText) {
    if (responseText === this.readyResponse) {
        this.progressbar.update(this.compareResultStep);
        this.getFileCount();
        return;
    }

    this.messageBox.show(responseText);
};

App.prototype.getFileCount = function() {
    this.ajaxHelper.createRequest(this.fileCountUrl, this.onGetFileCount, this);
    this.ajaxHelper.startRequest();
};

/**
 * @param { string } responseText
 */
App.prototype.onGetFileCount = function(responseText) {
    if (!isNaN(parseInt(responseText))) {
        this.fileCount = responseText;
        this.unzipStep = this.unpackProgressRange / this.fileCount;
        this.progressbar.update(this.fileCountStep);
        this.unpackZipFile(0);
        return;
    }

    this.messageBox.show(responseText);
};

App.prototype.unpackZipFile = function(step) {
    this.ajaxHelper.createRequest(this.unzipUrl + '&step=' + step, this.onUnpackProgress, this);
    this.ajaxHelper.startRequest();
};

/**
 * @param { string|number } responseText
 */
App.prototype.onUnpackProgress = function(responseText) {
    var current;

    if (responseText !== this.readyResponse) {
        current = this.unzipStep * responseText;

        if(isNaN(responseText)) {
            this.messageBox.show(responseText);
            return;
        }

        this.progressbar.update(current + this.fileCountStep);
        this.unpackZipFile(responseText);
        return;
    }

    this.onUnpackReady(responseText);
};

/**
 * Updates the progressbar to value 100 to start the tick animation
 *
 * @param { string } responseText
 */
App.prototype.onUnpackReady = function(responseText) {
    if (responseText !== this.readyResponse) {
        this.messageBox.show(responseText);
        return;
    }

    this.progressbar.update(100);

    this.ajaxHelper.createRequest(this.deleteUrl, () => {
        window.setTimeout(() => {
            window.location.href = this.installUrl;
        }, this.redirectTimeout);
    }, this);

    this.ajaxHelper.startRequest();
};

/**
 * @constructor
 * @param { object } config
 *
 * Like:
 * {
 *      elementSelector: '.loader-ring',
 *      baseValue: 700,
 *      groupLoadingSelector: '.group--loading',
 *      tickSelector: '.tick',
 *      fadeClass: 'fadein-fill',
 *      isFallback: false
 *  }
 */
function Progressbar(config) {
    this.elementSelector = config.elementSelector;
    this.baseValue = config.baseValue;
    this.groupLoadingSelector = config.groupLoadingSelector;
    this.tickSelector = config.tickSelector;
    this.fadeClass = config.fadeClass;
    this.useFallback = config.isFallback;

    this.init();
}

Progressbar.prototype.init = function() {
    this.progressBarIndicator = document.querySelector(this.elementSelector);
};

/**
 * @param { number } value
 */
Progressbar.prototype.update = function(value) {
    if (!value) {
        return;
    }

    if (this.useFallback) {
        this.progressBarIndicator.style.width = value + '%';
        return;
    }

    this.progressBarIndicator.style.strokeDashoffset = Math.floor(this.baseValue - (this.baseValue * (value / 100)));

    if (value === 100) {
        $(this.groupLoadingSelector).classList.add(this.fadeClass);
        $(this.tickSelector).style.strokeDashoffset = '0';
    }
};

/**
 * @param { MessageBox } messageBox
 * @constructor
 */
function Ajax(messageBox) {
    this.messageBox = messageBox;
    this.loadEventName = 'load';
    this.progressEventName = 'progress';
    this.requestMethod = 'POST';
}

/**
 * A empty function to call if no callback is defined
 */
Ajax.prototype.emptyFunction = function() {};

Ajax.prototype.init = function() {
    this.request = new XMLHttpRequest();

    if (this.requireProgress) {
        this.request.addEventListener(this.progressEventName, this.onProgress.bind(this));
    }

    this.request.addEventListener(this.loadEventName, this.onLoad.bind(this));
    this.request.open(this.requestMethod, this.url);
};

/**
 * @param { string } response
 */
Ajax.prototype.onLoad = function(response) {
    if (this.request.status >= 200 && this.request.status < 300) {
        this.loadCallback.call(this.scope, response.target.responseText);
        return;
    }

    this.messageBox.show(response.srcElement.responseText);
};

/**
 * @param { string } response
 */
Ajax.prototype.onProgress = function(response) {
    if (this.request.status >= 200 && this.request.status < 300) {
        this.progressCallback.call(this.scope, response.target.responseText);
        return;
    }

    this.messageBox.show(response.srcElement.responseText);
};

/**
 * if no progress callback is passed we dont register the progress event on the request object
 *
 * @param { string } url
 * @param { function } loadCallback
 * @param { object } scope
 * @param { function | null } progressCallback
 */
Ajax.prototype.createRequest = function(url, loadCallback, scope, progressCallback) {
    this.url = url;
    this.loadCallback = loadCallback || this.emptyFunction;
    this.scope = scope || this;
    this.progressCallback = progressCallback || false;

    if (typeof this.progressCallback === 'function') {
        this.requireProgress = true;
        this.progressCallback = progressCallback;
    } else {
        this.requireProgress = false;
        this.progressCallback = this.emptyFunction;
    }

    this.init();
};

Ajax.prototype.startRequest = function() {
    this.request.send();
};

/**
 * @param { string } elementSelector
 *
 * @constructor
 */
function MessageBox(elementSelector) {
    this.elementSelector = elementSelector;
    this.isHiddenClass = 'is--hidden';

    this.init();
}

MessageBox.prototype.init = function() {
    this.element = document.querySelector(this.elementSelector);
};

/**
 * if it is required to show a message throw a exception to stop the javascript
 *
 * @param { string } message
 */
MessageBox.prototype.show = function(message) {
    this.element.innerHTML = message.trim().replace(/^<br.+?>/, '');
    this.element.classList.remove(this.isHiddenClass);

    throw message;
};

ready(function() {
    var groupLogo = $('.group--logo'),
        groupLoading = $('.group--loading');

    prefixedEvent(groupLogo, 'animationend', function(event) {
        var aniName = event.animationName;

        groupLogo.classList.add('finished--' + aniName);

        switch (aniName) {
            case 'draw-outline':
                groupLogo.classList.add('fadein-fill');
                break;
            case 'fadein-fill':
                groupLoading.classList.add('expand-loader');
                break;
        }
    });

    prefixedEvent(groupLoading, 'animationend', function(event) {
        var aniName = event.animationName;

        groupLoading.classList.add('finished--' + aniName);

        switch (aniName) {
            case 'expand-loader':
                new App(uri, bufferSeparator, false);
        }
    });
});