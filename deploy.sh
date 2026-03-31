#!/bin/bash
# Agent Smith-Heffa — Déploiement DeepStream sur Nebius H200
# Usage: ./deploy.sh <NEBIUS_IP>
# Coût: ~$3.53/heure — éteindre la VM après usage

set -e
NEBIUS_IP="${1:?Usage: ./deploy.sh NEBIUS_IP}"
SSH_KEY="${SSH_KEY:-~/.ssh/viize-nebius-prod}"
USER="viize-nebius-prod"
REMOTE="/opt/smith-heffa-deepstream"
WEBHOOK="https://agent-smith-heffa-coding-buttertech-team.vercel.app/api/deepstream"
SECRET="${DEEPSTREAM_WEBHOOK_SECRET:-ds-secret-change-me-in-prod}"

echo "→ Connexion Nebius H200 @ $NEBIUS_IP"

# Créer le dossier distant
ssh -i "$SSH_KEY" "$USER@$NEBIUS_IP" "sudo mkdir -p $REMOTE && sudo chown $USER:$USER $REMOTE"

# Copier le script
scp -i "$SSH_KEY" pipeline_rtsp.py "$USER@$NEBIUS_IP:$REMOTE/"

# Lancer le container DeepStream
ssh -i "$SSH_KEY" "$USER@$NEBIUS_IP" "
  docker run --gpus all -it --rm \
    --name smith-heffa-deepstream \
    --network=host \
    --restart=unless-stopped \
    -e VERCEL_WEBHOOK_URL='$WEBHOOK' \
    -e DEEPSTREAM_WEBHOOK_SECRET='$SECRET' \
    -e RTSP_CAM_01='\${RTSP_CAM_01:-}' \
    -e RTSP_CAM_02='\${RTSP_CAM_02:-}' \
    -e RTSP_IPHONE='\${RTSP_IPHONE:-}' \
    -e CONFIDENCE_MIN='0.4' \
    -e WEBHOOK_INTERVAL_SEC='5' \
    -v $REMOTE:/workspace \
    nvcr.io/nvidia/deepstream:9.0-samples-multiarch \
    bash -c 'pip install pyds 2>/dev/null; python3 /workspace/pipeline_rtsp.py'
"
