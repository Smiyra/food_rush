# Use Debian Bookworm-based Node.js image (needed for apt-get to install MariaDB)
FROM node:18-bookworm

# Install MariaDB and dos2unix
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends mariadb-server dos2unix && \
    rm -rf /var/lib/apt/lists/*

# Fix MariaDB socket directory permissions
RUN mkdir -p /var/run/mysqld && chown -R mysql:mysql /var/run/mysqld

# ── Create the database user during BUILD time ──────────────────────────
# Start MariaDB temporarily, create the app user, then stop it.
# At build time, Docker runs as OS root so socket auth works perfectly.
RUN service mariadb start && \
    sleep 5 && \
    mariadb -e "CREATE DATABASE IF NOT EXISTS food_delivery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" && \
    mariadb -e "CREATE USER IF NOT EXISTS 'food_user'@'127.0.0.1' IDENTIFIED BY 'food_pass';" && \
    mariadb -e "GRANT ALL PRIVILEGES ON food_delivery.* TO 'food_user'@'127.0.0.1';" && \
    mariadb -e "CREATE USER IF NOT EXISTS 'food_user'@'localhost' IDENTIFIED BY 'food_pass';" && \
    mariadb -e "GRANT ALL PRIVILEGES ON food_delivery.* TO 'food_user'@'localhost';" && \
    mariadb -e "FLUSH PRIVILEGES;" && \
    service mariadb stop

WORKDIR /app

# Install Node dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy rest of the app
COPY . .

# Fix CRLF line endings on the startup script (Windows git adds \r\n)
RUN dos2unix /app/start.sh && chmod +x /app/start.sh

# Environment variables — internal DB user (not root)
# Render injects PORT automatically; default to 10000 (Render's default)
ENV PORT=10000
ENV MYSQL_HOST=127.0.0.1
ENV MYSQL_PORT=3306
ENV MYSQL_USER=food_user
ENV MYSQL_PASS=food_pass
ENV MYSQL_DB=food_delivery
ENV NODE_ENV=production

EXPOSE ${PORT}

CMD ["/app/start.sh"]
