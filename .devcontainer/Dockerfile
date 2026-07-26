FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install base dependencies
RUN apt-get update && apt-get install -y wget gpg coreutils sudo

# Add HashiCorp GPG key
RUN wget -O- https://apt.releases.hashicorp.com/gpg \
    | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add HashiCorp apt repository
RUN echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/hashicorp.list

# Install Nomad
RUN apt-get update && apt-get install -y nomad

# Create Nomad data directory
RUN mkdir -p /opt/nomad/data

# Create a custom user with sudo privileges (claude code --dangerously-skip-permissions requires non-root user)
RUN useradd -m -s /bin/bash user \
    && usermod -aG sudo user \
    && echo "user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/user \
    && chmod 0440 /etc/sudoers.d/user

# Set up node_modules volume
RUN mkdir -p /workspaces/learn-helper/node_modules \
    && chown -R user:user /workspaces

# Set up Claude volume (volume requires a directory, so we need a symlink hack for .claude.json)
RUN mkdir -p /home/user/.claude \
    && ln -snf /home/user/.claude/__do_not_use_user_claude.json /home/user/.claude.json \
    && chown -R user:user /home/user/.claude \
    && chown -h user:user /home/user/.claude.json

# Set up GitHub CLI volume
RUN mkdir -p /home/user/.config/gh \
    && chown -R user:user /home/user/.config

# Add cc alias
RUN printf "\nalias cc='claude --dangerously-skip-permissions'\n" >> /home/user/.bashrc
