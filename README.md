# Private Links Proxy

A minimal Node.js proxy server that forwards all incoming traffic to a VPC private link endpoint.

## Usage

1. Set the environment variable:

   ```bash
   export PRIVATE_LINK_DNS_NAME=your-vpc-endpoint.com
   ```

2. Start the server:
   ```bash
   npm start
   ```

The server will run on port 3000 by default (or the port specified in the `PORT` environment variable).

## Environment Variables

- `PRIVATE_LINK_DNS_NAME` (required): The DNS name of your VPC endpoint
- `PORT` (optional): The port to run the server on (default: 3000)

## How it works

The server receives all HTTP requests and forwards them to `https://${PRIVATE_LINK_DNS_NAME}`, preserving the original path, query parameters, headers, and request body. The response from the VPC endpoint is then returned to the client.
