const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 3000;
const PRIVATE_LINK_DNS_NAME = process.env.PRIVATE_LINK_DNS_NAME;

if (!PRIVATE_LINK_DNS_NAME) {
  console.error(
    "ERROR: PRIVATE_LINK_DNS_NAME environment variable is required",
  );
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  let responseEnded = false;

  // Parse the incoming request URL
  const parsedUrl = url.parse(req.url);

  // Prepare the target URL
  const targetUrl = url.format({
    protocol: "http:",
    hostname: PRIVATE_LINK_DNS_NAME,
    pathname: parsedUrl.pathname,
    search: parsedUrl.search,
  });

  // Log 1: Incoming request
  console.log(
    `[${requestId}] INCOMING: ${req.method} ${
      req.url
    } | Headers: ${JSON.stringify(req.headers)}`,
  );

  // Configure the proxy request
  const options = {
    method: req.method,
    headers: {
      ...req.headers,
      host: PRIVATE_LINK_DNS_NAME,
    },
    timeout: 30000, // 30 second timeout
    rejectUnauthorized: false, // Accept self-signed certificates
  };

  // Log 2: Request sent to private link
  console.log(
    `[${requestId}] SENT TO VPC: ${
      req.method
    } ${targetUrl} | Headers: ${JSON.stringify(options.headers)}`,
  );

  // Helper function to end response safely
  const endResponse = (statusCode, message) => {
    if (!responseEnded) {
      responseEnded = true;
      try {
        res.writeHead(statusCode);
        res.end(message);
      } catch (err) {
        console.error(`[${requestId}] Error ending response: ${err.message}`);
      }
    }
  };

  // Create the proxy request
  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    if (responseEnded) return;

    // Log 3: Response received from private link
    console.log(
      `[${requestId}] RECEIVED FROM VPC: ${
        proxyRes.statusCode
      } | Headers: ${JSON.stringify(proxyRes.headers)}`,
    );

    // Forward the status code and headers
    try {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      responseEnded = true;

      // Log 4: Response sent back to client
      console.log(
        `[${requestId}] SENT TO CLIENT: ${
          proxyRes.statusCode
        } | Headers: ${JSON.stringify(proxyRes.headers)}`,
      );

      // Pipe the response back to the client
      proxyRes.pipe(res);
    } catch (err) {
      console.error(`[${requestId}] Error forwarding response: ${err.message}`);
      endResponse(500, "Internal Server Error");
    }
  });

  // Handle proxy request errors
  proxyReq.on("error", (err) => {
    console.error(
      `[${requestId}] PROXY ERROR: ${err.message || "Unknown error"}`,
    );
    console.error(`[${requestId}] PROXY ERROR CODE: ${err.code || "Unknown"}`);
    endResponse(502, "Bad Gateway: " + (err.message || "Connection failed"));
  });

  // Handle timeout
  proxyReq.on("timeout", () => {
    console.error(
      `[${requestId}] PROXY TIMEOUT: Request timed out after 30 seconds`,
    );
    proxyReq.destroy();
    endResponse(504, "Gateway Timeout");
  });

  // Handle client disconnect
  req.on("close", () => {
    if (!responseEnded) {
      console.log(`[${requestId}] CLIENT DISCONNECTED`);
      proxyReq.destroy();
    }
  });

  // Pipe the request body to the proxy request
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Forwarding all traffic to: http://${PRIVATE_LINK_DNS_NAME}`);
});
