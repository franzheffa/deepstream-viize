# Agent Smith-Heffa — DeepStream RTSP Bridge
## Blanc · Noir · Or Pharaon · GCP ISV · NVIDIA AI Enterprise

## Démarrage rapide (quand tu as un client à démontrer)

### 1. Créer la VM Nebius (coût: $3.53/h)
Aller sur: https://console.nebius.com
→ Compute → Containers over VMs → "viize-deepstream"
→ Image: nvcr.io/nvidia/deepstream:9.0-samples-multiarch
→ GPU: H200 NVLink 141GB
→ Créer → noter l'IP publique

### 2. Déployer (depuis ce dossier)
```bash
export DEEPSTREAM_WEBHOOK_SECRET="ton-secret-prod"
export RTSP_CAM_01="rtsp://ip-camera:554/stream"
./deploy.sh TON_IP_NEBIUS
```

### 3. Vérifier que les webhooks arrivent
```bash
curl -s https://agent-smith-heffa-coding-buttertech-team.vercel.app/api/deepstream
```

### 4. Éteindre la VM après usage (stoppe les coûts)
Console Nebius → VM → Stop

## Variables d'environnement
| Variable | Description |
|---|---|
| RTSP_CAM_01 | URI caméra IP 1 (rtsp://...) |
| RTSP_CAM_02 | URI caméra IP 2 |
| RTSP_IPHONE | URI iPhone via app RTSP |
| DEEPSTREAM_WEBHOOK_SECRET | Secret webhook Vercel |
| CONFIDENCE_MIN | Seuil détection (défaut: 0.4) |
| WEBHOOK_INTERVAL_SEC | Intervalle envoi (défaut: 5s) |
