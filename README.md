# deepstream-viize 🏢

Real-time people counting using NVIDIA DeepStream SDK + PeopleNet (TAO).

## Stack
- NVIDIA DeepStream 6.x
- PeopleNet pruned_quantized_v2.3.2
- NvDsAnalytics (line crossing)
- Kafka (event streaming)

## Prerequisites
- DeepStream SDK installed at `/opt/nvidia/deepstream/deepstream`
- CUDA 11.8 (x86) or 11.4 (Jetson)
- Kafka running locally on port 9092

## Setup

### 1. Download PeopleNet model
```bash
cd config && ./model.sh && cd ..
```

### 2. Build
```bash
# x86
make CUDA_VER=11.8

# Jetson
make CUDA_VER=11.4
```

### 3. Configure platform path
```bash
# x86
sed -i "s|^# msg-conv-msg2p-lib=.*x86.*|msg-conv-msg2p-lib=$(pwd)/bin/x86/libnvds_msgconv.so|" \
  config/dstest_occupancy_analytics.txt

# Jetson
sed -i "s|^# msg-conv-msg2p-lib=.*jetson.*|msg-conv-msg2p-lib=$(pwd)/bin/jetson/libnvds_msgconv.so|" \
  config/dstest_occupancy_analytics.txt
```

### 4. Start Kafka
```bash
bin/zookeeper-server-start.sh config/zookeeper.properties &
bin/kafka-server-start.sh config/server.properties &
bin/kafka-topics.sh --create --topic quickstart-events \
  --bootstrap-server localhost:9092
```

### 5. Run
```bash
./deepstream-test5-analytics -c config/dstest_occupancy_analytics.txt
```

### 6. Monitor Kafka messages
```bash
bin/kafka-console-consumer.sh --topic quickstart-events \
  --from-beginning --bootstrap-server localhost:9092
```

## Architecture
```
[Video Source] → [PeopleNet Detector] → [Tracker] → [NvDsAnalytics]
                                                           ↓
                                              [Entry/Exit Line Crossing]
                                                           ↓
                                              [Kafka → Cloud / Dashboard]
```

## References
- [DeepStream SDK](https://developer.nvidia.com/deepstream-sdk)
- [PeopleNet on NGC](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/tao/models/peoplenet)
