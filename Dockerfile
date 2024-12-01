FROM oven/bun:latest

# Add project code
COPY . /app/

WORKDIR /app

CMD ["bun", "install"]

CMD ["bun", "run", "start"]
