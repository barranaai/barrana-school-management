# Isolated demo replica set

Provisioned using compose.demo.yml; no data restored and application URI unchanged.

| Purpose | Container | Host endpoint | Replica set | Storage |
|---|---|---|---|---|
| Original demo | barrana-mongodb | 127.0.0.1:27017/barrana_ai | standalone | barrana-mongodb-data (unchanged) |
| Integration tests | kidsible-mongodb-integration | 127.0.0.1:27018/kidsible_integration | kidsible-test-rs | kidsible-integration-data/config |
| New demo | kidsible-mongodb-demo | 127.0.0.1:27019/barrana_ai | kidsible-demo-rs | kidsible-demo-data, kidsible-demo-config |

Image: mongodb/mongodb-community-server:8.0.29-ubi9-slim. Host binding is loopback
only. The image entrypoint adds bind_ip_all; do not duplicate that command option.
Restart policy is no. This single-node local deployment provides transactions, not HA.

The initializer backend/demo-infrastructure/init-replica-set.js checks the container
hostname, explicit port, MongoDB version and replica-set configuration. It recognizes
only error code 94 as an uninitialized replica set and refuses reconfiguration.
It is mounted read-only and is not automatically executed at startup.

Provisioning commands (already performed; do not run against other Compose files):

```powershell
docker compose -f compose.demo.yml up -d --no-deps mongodb-demo
docker compose -f compose.demo.yml exec -T mongodb-demo mongosh --quiet --nodb /opt/kidsible/init-demo.js
```

Verified PRIMARY and a committed synthetic transaction from the host endpoint. Its
unique temporary collection was removed; no collections remain in the new barrana_ai.
Replica-set internal system data remains as expected. No restore or application data
creation occurred. No original container or volume changes were required.

Any restore and application cutover requires separate authorization. Backup ownership,
consistency and verification remain solely with the database owner/operator. This
infrastructure task did not create, inspect or certify a backup. Do not run init-mongo.js,
seed scripts, integration suites, or fixtures against this new demo instance.
