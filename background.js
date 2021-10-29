console.log("Loaded")
chrome.browserAction.onClicked.addListener(function (tab) { //Fired when User Clicks ICON
    console.log(tab.url)
    if (tab.url.indexOf("https://e-hentai.org/g") != -1) { // Inspect whether the place where user clicked matches with our list of URL
    console.log("START")
        chrome.tabs.executeScript(tab.id, {
            "file": "getImages.js"
        }, function () { // Execute your code
            console.log("Script Executed .. "); // Notification on Completion
        });
    }
});