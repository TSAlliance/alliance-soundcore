#!/bin/bash

read -p "Enter you master key: " masterKey

# Update the list of available packages and their versions
sudo apt update && sudo apt upgrade -y

# Install curl which is required to install Meilisearch in the next step
sudo apt install curl -y

# Install Meilisearch latest version from the script
curl -L https://install.meilisearch.com | sh

# Move the Meilisearch binary to your system binaries
mv ./meilisearch /usr/bin/

# Write service file for meilisearch
sudo cat << EOF > /etc/systemd/system/meilisearch.service
[Unit]
Description=Meilisearch
After=systemd-user-sessions.service

[Service]
Type=simple
ExecStart=/usr/bin/meilisearch --http-addr 127.0.0.1:7700 --env production --master-key $masterKey

[Install]
WantedBy=default.target
EOF

# Set the service meilisearch
sudo systemctl enable meilisearch

# Start the meilisearch service
sudo systemctl start meilisearch

# Verify that the service is actually running
sudo systemctl status meilisearch

echo 
echo 
echo []==============================[]
echo Install script ended. If you see the systemctl 
echo output above printing an active status for the service,
echo it most likely worked :)