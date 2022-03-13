#!/bin/bash

# Request elevation
sudo apt update
sudo apt upgrade -y

# Install Java JRE 11, unzip
sudo apt install openjdk-11-jre unzip -y


# Download Keycloak 17.0.0 ZIP Archive
sudo wget https://github.com/keycloak/keycloak/releases/download/17.0.0/keycloak-17.0.0.zip

# Unzip to specific directory
sudo unzip keycloak-17.0.0.zip -d /opt/keycloak

# Set permissions
sudo chmod 777 -R /opt/keycloak

# Run keycloak in development mode
/opt/keycloak/keycloak-17.0.0/bin/kc.sh start-dev
# sudo sed -i 's///' /etc/environment