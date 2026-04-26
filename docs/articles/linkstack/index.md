# LinkStack

## What this page contains

Notes, commands, configs used for the **LinkStack** installation.

![LinkStack Screenshot](/images/linkstack/logo.png)

LinkStack is an open-source, self-hosted alternative to Linktree, allowing users to create a customizable profile page to share multiple links, hosted on their own server.

## Notes / Walkthrough

### Docker Compose

Below is a basic docker-compose.yaml to bring LinkStack up.


## Configuration Example

```yaml
services:
  linkstack:
    image: linkstackorg/linkstack:latest
    environment:
      - TZ=Asia/Kolkata
       - SERVER_ADMIN=admin@example.xyz
      - HTTP_SERVER_NAME=www.example.xyz
      - HTTPS_SERVER_NAME=www.example.xyz
      - LOG_LEVEL=info
      - PHP_MEMORY_LIMIT=512M
      - UPLOAD_MAX_FILESIZE=16M
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - linkstack:/htdocs
    restart: unless-stopped
volumes:
  linkstack:
```


## Commands

```bash
# example command
docker compose up -d
```


## Screenshots

### Dashboard
![Dashboard](/images/linkstack/ss-1.png)

### Preview screen
![Preview screen](/images/linkstack/ss-2.png)



## References

[LinkStack GitHub](https://github.com/LinkStackOrg/LinkStack)

[LinkStack Website](https://linkstack.org/)

[LinkStack Documentation](https://docs.linkstack.org/)