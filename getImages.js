var url = document.URL;
var ss = url.split("/");
var images = [];
var thumbs = [];
var started = false;

var count = 0;
var thread = 0;
var maxThread = 3;
var threadLife = [];
var imgLoadTimeout = 20000;
var timeout = 0;

console.log(ss);

// Get GID, Token & Image links

if (ss[3] === "g") {
    var total = parseInt(document.querySelector(".ptt td:last-child").previousElementSibling.children[0].innerHTML);
    console.log({ total });
    var cleanUrl = "https://e-hentai.org/g/" + ss[4] + "/" + ss[5] + "/?p=";
    console.log({ cleanUrl });

    // Proceed to get the links
    for (var i = 0; i < total; i++) {
        var page = cleanUrl + i;
        setTimeout(function (s) {
            return function () {
                fetch(s).then(response => response.text()).then(result => {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(result, 'text/html');
                    var gt100Elements = doc.querySelectorAll(".gt100");

                    gt100Elements.forEach(function (element) {

                      var links = element.querySelectorAll("a");
                      
                      links.forEach(function(linkElement) {
                          var link = linkElement.getAttribute('href');
                          console.log(link);
                          count++;
                          images.push(link);
                          thumbs.push(linkElement.innerHTML);
                          startDownload();
                      });
                  });

                    console.log(images);
                });
            };
        }(page), i * 3000);
    }
}

function startDownload() {
    if (!started) {
        // Clear
        document.querySelectorAll("iframe").forEach(iframe => iframe.remove());
        var desc = document.querySelector(".gm");

        document.body.innerHTML = "";
        document.body.appendChild(desc);
        document.body.style.textAlign = "center";
        document.body.style.background = "#000";

        console.log("Start Download");
        started = true;

        var loop = setInterval(function () {
            if (thread < maxThread) {
                if (images.length) {
                    var div = document.createElement("div");
                    div.style.paddingBottom = "10px";

                    var link = images.shift();
                    fetch(link).then(response => response.text()).then(result => {
                        var parser = new DOMParser();
                        var doc = parser.parseFromString(result, 'text/html');
                        var img = doc.querySelector("#img");

                        if (img) {
                            var imgElement = img.cloneNode(true);
                            imgElement.style.width = "1000px";
                            imgElement.style.height = "auto";

                            div.appendChild(imgElement);
                            document.body.appendChild(div);

                            imgElement.onload = function () {
                                if (thread > 0) {
                                    thread--;
                                }
                                console.log('load done');
                            };

                            if (imgElement.complete) {
                                imgElement.onload();
                            }

                            thread++;
                        }
                    });
                }
            } else {
                if (images.length > 0) {
                    timeout += 1000;
                    if (timeout > imgLoadTimeout) {
                        thread = 0;
                        timeout = 0;
                    }
                }
            }
        }, 1000);
    }
}