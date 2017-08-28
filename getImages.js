  var url = document.URL;
  var ss = url.split("/");
  var images = new Array();
  var thumbs = new Array();
  var started = false;

  var count = 0;

  var thread = 0;
  var maxThread = 3;

  var threadLife = new Array();
  var imgLoadTimeout = 20000;

  var timeout = 0;

  console.log(ss);


  //Get GID, Token & Image links


  if (ss[3] == "g") {
    var total = parseInt($(".ptt td").last().prev().children().html());
    console.log(total)
    var cleanUrl = "https://e-hentai.org/g/"+ss[4]+"/"+ss[5]+"/?p=";
    console.log(cleanUrl);

    //Proceed to get the links
    for (var i = 0; i < total; i++) {
      var page = cleanUrl+i;
      setTimeout(function(s){
        return function() {
          // console.log(">>> parse: " + s);
          $.get(s, function(result) {
            $(result).find(".gdtm").each(function(){
              console.log($(this).find("a").attr('href'));
              count++;
              images.push($(this).find("a").attr("href"));
              thumbs.push($(this).find("a").html());
              startDownload();
            });
            console.log(images)
          });
        };
      }(page), i * 3000);
    }
  }

  function startDownload() {
    if (!started) {

      //Clear
      $("iframe").remove();
      var desc = $(".gm").first();

      $("body").html("");
      $("body").append(desc);
      $("body").css({
        "text-align":"center",
        "background":"#000"
      });



      console.log("Start Download");
      started = true;


      var loop = setInterval(function() {
        if (thread < maxThread) {
          if (images.length) {
            var div = $("<div style='padding-bottom: 10px'></div>");
            var link = images.shift();
            div.load(link+" #img", function(){
              $("body").append(div);
              div.children("img").css({
                "width":"1000px",
                "height": "auto"});
              div.children("img").one('load', function() {
                // do stuff
                if (thread > 0) {
                  thread--;
                }
                console.log('load done');
              }).each(function() {
                if(this.complete) $(this).load();
              });

            });
            thread++;
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
      },1000);

    }
  }

