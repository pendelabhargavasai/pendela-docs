# Termix

---

## What this page contains

Notes, commands, and downloadable example files used in the **Termix** video.

---

## Notes / Walkthrough

---

### Step 1 — Docker Compose

Below is a basic docker-compose.yaml to bring termix up.

---

## Configuration Example

```yaml
services:
  termix:
    image: bugattiguy527/termix:latest
    container_name: termix
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - termix-data:/app/data
    environment:
      PORT: "8080"

volumes:
  termix-data:
    driver: local
```

---

## Commands

```bash
# example command
docker compose up -d
```

## Files

[Download All Files (ZIP)](/files/termix/termix-files.zip)

## Reference YouTube Video

- [45Homelab Termix Video](https://www.youtube.com/watch?v=Jw6vh2eOomo)

## References

[Termix GitHub](https://github.com/Termix-SSH/Termix)

[Termix Website](https://termix.site/)