#!/bin/bash
read -p "Enter your master key: " masterKey < /dev/tty

# Update the list of available packages and their versions
sudo apt update && sudo apt upgrade -y

# Install curl which is required to install Meilisearch in the next step
sudo apt install curl -y

# Install Meilisearch latest version from the script
curl -sL https://install.meilisearch.com | sh

# Move the Meilisearch binary to your system binaries
sudo mv ./meilisearch /usr/bin/

# Write service file for meilisearch
sudo cat << EOF > meilisearch.service
[Unit]
Description=Meilisearch
After=systemd-user-sessions.service

[Service]
Type=simple
ExecStart=/usr/bin/meilisearch --http-addr 127.0.0.1:7700 --env production --master-key $masterKey

[Install]
WantedBy=default.target
EOF
sudo mv ./meilisearch.service /etc/systemd/system/meilisearch.service

# Set the service meilisearch
sudo systemctl enable meilisearch.service

# Start the meilisearch service
sudo systemctl start meilisearch

# Verify that the service is actually running
sudo systemctl status meilisearch

echo 
echo 
echo []==============================[]
echo Install script ended. If you see the systemctl 
echo output above printing an active status for the service,
echo it most likely worked :\)

# Return api keys
curl -X GET 'http://127.0.0.1:7700/keys' -H 'Authorization: Bearer $masterKey'