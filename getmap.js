const https = require("https");
const fs = require("fs");

const options = {
  hostname: "upload.wikimedia.org",
  port: 443,
  path: "/wikipedia/commons/thumb/e/ec/Montreal-metro.svg/800px-Montreal-metro.svg.png",
  method: "GET",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
};

https
  .get(options, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Failed to fetch: ${res.statusCode}`);
      return;
    }
    const file = fs.createWriteStream("public/map.png");
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("Download Completed");
    });
  })
  .on("error", (err) => {
    console.log("Error: ", err.message);
  });
