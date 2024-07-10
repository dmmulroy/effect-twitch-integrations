FROM oven/bun:latest

# Add project code
COPY . /app/

WORKDIR /app

# Add a volume
VOLUME /data/nix_timer

CMD ["bun", "install"]

CMD ["bun", "run", "start"]
