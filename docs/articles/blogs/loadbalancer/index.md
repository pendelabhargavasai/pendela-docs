# The Ultimate Guide to Kubernetes Load Balancers in 2026 (K3s Edition)

> **TL;DR** — Running K3s on bare metal or edge? This guide dissects every major Kubernetes load balancer — NGINX, Traefik, MetalLB, HAProxy, Envoy, Cilium, Istio, Linkerd, and K3s's own Klipper — across architecture, performance, K3s compatibility, and real-world use cases. Pick the right one for your stack, once and for all.

---

## 🧭 Why This Guide Exists

Kubernetes load balancers are one of the most confusing corners of the cloud-native ecosystem. Search for "best Kubernetes load balancer" and you'll find a dozen blog posts each recommending something different, often without context. When you throw **K3s** — the lightweight, single-binary Kubernetes distribution from Rancher — into the mix, the confusion compounds further.

K3s ships with its own built-in load balancer (Klipper/ServiceLB) and its own ingress controller (Traefik). But is that the right choice for your production workload? What if you need BGP routing, service mesh capabilities, or sub-millisecond latency?

This guide covers every serious option in the market today, with real benchmarks, architecture diagrams, and clear K3s-specific guidance.

---

## 🗺️ The Landscape: What Are We Even Comparing?

Before diving in, let's clarify the terminology. "Load balancer" in Kubernetes refers to multiple layers:

| Layer | What It Does | Example Tools |
|---|---|---|
| **L4 LoadBalancer (IP/TCP)** | Assigns external IPs to Services | MetalLB, Klipper, Kube-VIP |
| **L7 Ingress Controller** | Routes HTTP/HTTPS traffic by host/path | NGINX, Traefik, HAProxy |
| **Reverse Proxy / Edge Proxy** | Advanced traffic shaping, retries, circuit breaking | Envoy, HAProxy |
| **Service Mesh** | East-west (pod-to-pod) traffic management + security | Istio, Linkerd, Cilium |

Most real deployments combine tools from multiple layers. For K3s, a typical production stack might be: **MetalLB** (L4) + **Traefik** (L7 Ingress) + optionally **Linkerd** (mesh).

---

## 🔬 Competitor Deep-Dive

### 1. 🏠 Klipper ServiceLB (K3s Built-In)

**What it is**: K3s's embedded load balancer, enabled by default. Uses host ports and iptables rules to forward traffic.

**Architecture**:
```
External Traffic
      │
      ▼
[Node HostPort] ──iptables──► [ClusterIP] ──► [Pod]
      ▲
[DaemonSet: svc-* pods on each node]
```

**How it works**: For each `LoadBalancer` Service, Klipper creates a DaemonSet with `svc-` prefixed pods that bind to the host port. The node's own external IP is reported as the `EXTERNAL-IP`. There is no IP announcement to the network — it simply binds ports.

**K3s-specific note**: Klipper is enabled by default. To run MetalLB or any other LB controller, you must disable it:
```bash
# During K3s install
curl -sfL https://get.k3s.io | sh -s - --disable servicelb

# Or in K3s config file
disable:
  - servicelb
```

| Feature | Rating |
|---|---|
| Zero config | ✅ Built-in |
| True IP announcement | ❌ No |
| BGP support | ❌ No |
| Multi-node HA | ⚠️ Failover only |
| Production-readiness | ⚠️ Dev/small clusters |
| Resource usage | ✅ Minimal |

**Best for**: Local dev, single-node K3s, homelab, quick demos.

---

### 2. 🟢 NGINX Ingress Controller

**What it is**: The most widely deployed Kubernetes Ingress controller, based on the battle-tested NGINX reverse proxy. Two major variants exist: the community `ingress-nginx` and the commercial NGINX Inc. version (`nginx-ingress`).

**Architecture**:
```
Internet
   │
   ▼
[NGINX Pod]
   │  Reads Ingress rules + Annotations
   ├──► /app-a  ──► Service A ──► Pods
   ├──► /app-b  ──► Service B ──► Pods
   └──► /api    ──► Service C ──► Pods
        │
   [ConfigMap / Annotations drive nginx.conf]
```

**Key features**:
- Annotation-driven configuration (granular control via `nginx.ingress.kubernetes.io/*`)
- SSL termination, wildcard certs, HSTS
- Rate limiting, IP allowlisting, custom error pages
- WebSocket support, gRPC proxying
- Prometheus metrics out of the box
- ModSecurity WAF support (community build)

**K3s installation**:
```bash
# First, disable K3s's default Traefik if you want NGINX instead
curl -sfL https://get.k3s.io | sh -s - --disable traefik

# Install NGINX Ingress via Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

**Sample Ingress resource**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app-svc
            port:
              number: 80
```

**Performance**: NGINX processes ~30,000–40,000 RPS per instance in typical Kubernetes ingress scenarios. Config reloads happen on Ingress updates (brief traffic disruption is possible on busy clusters).

| Feature | Rating |
|---|---|
| Community & docs | ✅ Massive |
| Annotation flexibility | ✅ Excellent |
| Auto TLS (Let's Encrypt) | ⚠️ Needs cert-manager |
| Dynamic config (no reload) | ❌ Requires reload |
| Performance | ✅ Very good |
| K3s compatibility | ✅ Excellent |
| Learning curve | ✅ Low |

**Best for**: Teams migrating from traditional NGINX setups, production HTTP/HTTPS workloads, teams needing extensive annotation-based customization.

---

### 3. 🐹 Traefik (K3s Default)

**What it is**: A cloud-native reverse proxy and ingress controller written in Go. K3s ships Traefik v2 by default (upgraded to v3 in recent K3s releases). It auto-discovers services via Kubernetes CRDs and annotations.

**Architecture**:
```
Internet
   │
   ▼
[Traefik Proxy]
   │  Watches: IngressRoutes, Ingress, Services
   │  Providers: Kubernetes CRD, Kubernetes Ingress
   │
   ├─[Routers]──[Middlewares]──[Services]──► Pods
   │     │            │
   │  Host/Path    RateLimit
   │  rules        Auth
   │               Retry
   │
   └─[Dashboard: :8080]  [Metrics: Prometheus]
```

**Key features**:
- **Zero-config service discovery** — annotate a Service and Traefik picks it up instantly, no config file reloads
- Automatic Let's Encrypt TLS with ACME challenge support
- Middleware system: auth, rate limiting, headers, circuit breakers, retry
- Native IngressRoute CRDs for full power
- Built-in dashboard and Prometheus metrics
- TCP/UDP routing support (not just HTTP)

**K3s-specific note**: Traefik is bundled and managed by K3s. To customize it, use a HelmChartConfig:
```yaml
# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    dashboard:
      enabled: true
    additionalArguments:
      - "--entrypoints.websecure.http.tls"
    ports:
      web:
        redirectTo: websecure
```

**Sample IngressRoute**:
```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: my-app
spec:
  entryPoints:
    - websecure
  routes:
  - match: Host(`myapp.example.com`)
    kind: Rule
    services:
    - name: my-app-svc
      port: 80
    middlewares:
    - name: rate-limit
  tls:
    certResolver: letsencrypt
```

**Performance**: Traefik handles ~19,000 RPS with very stable resource consumption and zero-reload dynamic config — a key advantage over NGINX for fast-moving microservices.

| Feature | Rating |
|---|---|
| K3s integration | ✅ Native, bundled |
| Auto TLS (Let's Encrypt) | ✅ Built-in ACME |
| Dynamic config (no reload) | ✅ Real-time |
| Dashboard | ✅ Built-in |
| TCP/UDP routing | ✅ Yes |
| Performance vs NGINX | ⚠️ Slightly lower RPS |
| Enterprise features | ⚠️ Enterprise version needed |

**Best for**: K3s default stack, teams wanting zero-touch TLS, GitOps-friendly pipelines, dev-friendly environments.

---

### 4. 🔷 MetalLB

**What it is**: A bare-metal L4 load balancer for Kubernetes. It gives `LoadBalancer` type Services an actual external IP from a pool you define, using either **Layer 2 (ARP)** or **BGP** protocols.

**Architecture (Layer 2 mode)**:
```
External Network
      │
      │  ARP: "Who has 192.168.1.100?" → Leader Node replies
      ▼
[Leader Node] ──► kube-proxy ──► Service Pods (all nodes)
      │
[MetalLB Speaker DaemonSet] on every node
[MetalLB Controller] handles IP assignment
```

**Architecture (BGP mode)**:
```
[Router/Switch]
      │  BGP peering
      ▼
[MetalLB Speaker] on each K3s node
      │  Announces /32 routes per service IP
      ▼
[Direct packet routing to node]
```

**K3s installation**:
```bash
# Step 1: Disable Klipper
curl -sfL https://get.k3s.io | sh -s - --disable servicelb

# Step 2: Install MetalLB
helm repo add metallb https://metallb.github.io/metallb
helm install metallb metallb/metallb -n metallb-system --create-namespace

# Step 3: Configure IP pool
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: k3s-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.220
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: k3s-l2
  namespace: metallb-system
EOF
```

**Important caveat**: In L2 mode, MetalLB doesn't truly load-balance at L4 — it elects a leader node that handles ARP for a given IP, and kube-proxy does the actual pod distribution. It's more of a **failover mechanism** than a true LB. BGP mode provides real per-node distribution but requires BGP-capable routers.

| Feature | Rating |
|---|---|
| Bare-metal IP assignment | ✅ Core purpose |
| BGP mode | ✅ Yes |
| Layer 2 mode | ✅ Yes (ARP/NDP) |
| True L4 load balancing | ⚠️ BGP only |
| K3s compatibility | ✅ Excellent (disable Klipper first) |
| Resource usage | ✅ Very lightweight |
| Requires routers | ⚠️ BGP mode does |

**Best for**: Bare-metal K3s clusters that need proper external IPs, homelab with a VLAN IP pool, edge deployments without cloud LB.

---

### 5. ⚡ HAProxy Ingress Controller

**What it is**: The Kubernetes ingress controller backed by HAProxy — historically the gold standard for raw TCP/HTTP load balancing performance. HAProxy Technologies' own benchmarks show their ingress controller handling **42,000 RPS** with the lowest CPU among all competitors.

**Architecture**:
```
Internet
   │
   ▼
[HAProxy Pod]
   │  Config generated from Ingress/CRDs by controller
   │
   ├─[Frontend: bind *:80]
   │       │
   │  [ACL rules: path_beg, hdr_dom]
   │       │
   └─[Backend pools] ──► Pod endpoints (health-checked)
         │
   [Stats: :1936]  [Prometheus metrics]
```

**Key features**:
- Best-in-class raw throughput and lowest latency at scale
- Native support for HTTP/3, QUIC, gRPC
- Fine-grained connection control (timeouts, retries, stick tables)
- Advanced Layer 7 routing: headers, cookies, ACLs
- TCP mode for non-HTTP workloads
- Gateway API support (HAProxy Ingress Controller v3.1+)

**K3s installation**:
```bash
helm repo add haproxytech https://haproxytech.github.io/helm-charts
helm install haproxy-ingress haproxytech/kubernetes-ingress \
  --namespace haproxy-controller --create-namespace \
  --set controller.service.type=LoadBalancer
```

**Performance edge**: In head-to-head benchmarks against NGINX, Traefik, and Envoy:
- **HAProxy**: 42,000 RPS, 50% CPU
- **NGINX**: ~35,000 RPS, ~65% CPU  
- **Traefik**: ~19,000 RPS, ~45% CPU (more consistent)
- **Envoy**: ~38,000 RPS, 73% CPU

| Feature | Rating |
|---|---|
| Raw throughput | ✅ Best-in-class |
| HTTP/3 & gRPC | ✅ Yes |
| Advanced ACLs | ✅ Very powerful |
| Auto TLS | ⚠️ Needs cert-manager |
| Dynamic config | ✅ v2.4+ hitless reload |
| K3s compatibility | ✅ Good |
| Complexity | ⚠️ Steeper learning curve |

**Best for**: High-throughput production clusters, financial services, teams needing ultra-low p99 latency, TCP-heavy workloads.

---

### 6. 🌊 Envoy Proxy

**What it is**: Originally built at Lyft, Envoy is a high-performance C++ proxy that has become the **de facto data plane** of the cloud-native ecosystem. It powers Istio, Consul Connect, AWS App Mesh, and is the backbone of the Kubernetes Gateway API ecosystem.

**Architecture**:
```
[xDS Control Plane] (e.g., Istio's istiod)
       │  gRPC streaming: LDS, RDS, CDS, EDS
       ▼
[Envoy Proxy Instance]
   │
   ├─ Listeners (ports/protocols)
   │       │
   │  Filter Chains (HTTP, TCP, gRPC filters)
   │       │
   └─ Clusters (upstream endpoints)
         │
      [Circuit Breaker] [Retry] [Outlier Detection]
```

**Key features**:
- Dynamic configuration via xDS API (zero-downtime updates)
- Built-in circuit breaking, retries, outlier detection
- Excellent observability: detailed stats, tracing (Zipkin/Jaeger/OTLP), access logs
- gRPC-first with HTTP/1.1 and HTTP/2 support
- Mutual TLS (mTLS) between services
- WebAssembly (Wasm) plugin extensibility
- Rate limiting via external services (Ratelimit service)

**Standalone on K3s** (without Istio):
```bash
# Envoy Gateway — standalone Gateway API implementation
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --version v1.2.0 -n envoy-gateway-system --create-namespace
```

**Performance**: Envoy delivers ~38,000 RPS with excellent handling of dynamic service churn (critical for microservices that scale up/down frequently). Its sub-10ms latency during pod scaling events makes it ideal for Netflix/Uber-style workloads.

| Feature | Rating |
|---|---|
| Dynamic config (xDS) | ✅ Best-in-class |
| Observability | ✅ Exceptional |
| gRPC support | ✅ Native |
| Circuit breaking | ✅ Built-in |
| Wasm extensibility | ✅ Yes |
| Standalone complexity | ⚠️ High (needs control plane) |
| K3s standalone use | ⚠️ Via Envoy Gateway |

**Best for**: Microservices architectures with dynamic service discovery, service mesh data plane, teams that need xDS-compatible control plane integration.

---

### 7. 🕸️ Istio (Service Mesh)

**What it is**: The most feature-complete service mesh for Kubernetes. Istio injects Envoy sidecars into every pod and manages the entire service-to-service communication layer via a centralized control plane (`istiod`).

**Architecture**:
```
[istiod - Control Plane]
   ├── Pilot (traffic management)
   ├── Citadel (certificate authority)
   └── Galley (config validation)
         │  xDS API
         ▼
[Pod A]                    [Pod B]
  App Container              App Container
  Envoy Sidecar ◄──mTLS──► Envoy Sidecar
  (intercepts all traffic)   (intercepts all traffic)
```

**Istio Ambient Mode** (2024/2026): The new sidecar-free mode using per-node "ztunnel" proxies + optional Waypoint proxies eliminates the double-hop latency, bringing performance near bare-metal levels.

**Key features**:
- Fine-grained traffic management: canary, A/B, weighted routing, fault injection
- Automatic mTLS between all services
- Authorization policies at L7 (RBAC per HTTP path/method)
- Distributed tracing, Kiali topology visualization
- Multi-cluster and VM support
- Gateway API support

**K3s resource requirements** (important!):
- istiod: ~500MB RAM
- Per-pod Envoy sidecar: ~50MB RAM each
- At 500 services: **25–50GB extra RAM vs. Linkerd** — plan accordingly

```bash
# Install Istio on K3s
curl -L https://istio.io/downloadIstio | sh -
istioctl install --set profile=minimal -y
kubectl label namespace default istio-injection=enabled
```

| Feature | Rating |
|---|---|
| Traffic management | ✅ Most advanced |
| mTLS | ✅ Automatic |
| Observability | ✅ Full stack (Kiali, Jaeger) |
| Authorization policies | ✅ L7 RBAC |
| Resource usage | ❌ Heavy (per-pod sidecar) |
| Complexity | ❌ High |
| K3s (small cluster) | ⚠️ Feasible, watch RAM |

**Best for**: Enterprise Kubernetes, SOC 2/PCI-DSS compliance requirements, teams needing canary deployments and fault injection, hybrid VM+K8s environments.

---

### 8. 🔗 Linkerd (Service Mesh)

**What it is**: The original service mesh (coined the term in 2016). Linkerd uses a Rust-based "microproxy" instead of Envoy — dramatically lighter weight, making it the **fastest and most resource-efficient** service mesh available.

**Architecture**:
```
[Linkerd Control Plane]
  ├── destination (service discovery)
  ├── identity (certificate authority)
  └── proxy-injector (sidecar injection)
         │
[Pod A]                    [Pod B]
  App Container              App Container
  linkerd2-proxy ◄──mTLS──► linkerd2-proxy
  (Rust, ~10MB RAM each)     (tiny overhead!)
```

**Performance benchmarks** (vs other meshes):
- Linkerd: ~5–10% slower than baseline (no mesh) — **best among all meshes**
- Istio: ~25–35% slower than baseline
- Cilium Mesh: ~20–30% slower than baseline

**Key features**:
- Automatic mTLS (on by default, zero config)
- Golden signals dashboard (latency, traffic, errors, saturation)
- Per-route metrics
- Traffic splitting (canary, A/B)
- Multi-cluster support
- FIPS-compliant builds available
- Graduated CNCF project (most mature after Istio)

**K3s installation**:
```bash
# Install Linkerd CLI
curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh

# Pre-flight check
linkerd check --pre

# Install on K3s
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -
linkerd check

# Inject into a namespace
kubectl annotate namespace default linkerd.io/inject=enabled
```

| Feature | Rating |
|---|---|
| Resource efficiency | ✅ Best among meshes |
| Performance overhead | ✅ Minimal (5–10%) |
| mTLS | ✅ Auto, zero-config |
| Simplicity | ✅ Easiest mesh |
| Dashboard | ✅ Built-in |
| Advanced traffic routing | ⚠️ Less than Istio |
| K3s compatibility | ✅ Excellent |

**Best for**: Teams wanting mesh capabilities without Istio's complexity, K3s clusters with limited RAM, security-first teams, anyone who wants to "just turn it on and have it work."

---

### 9. 🧬 Cilium (eBPF-based CNI + Service Mesh)

**What it is**: Cilium is fundamentally different from all others — it operates at the **Linux kernel level using eBPF** (extended Berkeley Packet Filter), replacing traditional iptables networking entirely. It serves as both a CNI (network plugin) and optionally a service mesh.

**Architecture**:
```
[Cilium Operator] + [Cilium Agent DaemonSet]
         │  Programs eBPF maps
         ▼
[Linux Kernel - eBPF programs]
   ├── XDP (eXpress Data Path): packet filtering at NIC level
   ├── TC (Traffic Control): L3/L4 policy enforcement
   └── Socket: L7 visibility (HTTP, gRPC, Kafka, DNS)
         │
[Hubble Observability Layer]
   ├── hubble-relay
   └── hubble-ui (real-time network flow visualization)
```

**Key features**:
- **eBPF-powered networking**: bypasses kernel overhead, hardware-speed L4
- No iptables — replaces kube-proxy entirely
- Deep observability via Hubble (DNS, HTTP, gRPC, Kafka at kernel level)
- Network policies at L3/L4/L7 in a single CRD
- WireGuard/IPsec transparent encryption
- Service mesh in **per-node Envoy** model (not sidecar-per-pod)
- Excellent for multi-cluster with Cluster Mesh

**K3s installation**:
```bash
# Disable K3s's default flannel (Cilium replaces it)
curl -sfL https://get.k3s.io | sh -s - \
  --flannel-backend=none \
  --disable-network-policy \
  --disable servicelb

# Install Cilium
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set operator.replicas=1 \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=<K3S_SERVER_IP> \
  --set k8sServicePort=6443

# Enable Hubble
cilium hubble enable --ui
```

**L4 performance**: Cilium's eBPF datapath is unrivaled for L4 (TCP/UDP) — limited only by hardware NIC speed. For L7 (HTTP), it offloads to per-node Envoy, which introduces some trade-offs vs. per-pod sidecar isolation.

| Feature | Rating |
|---|---|
| L4 throughput | ✅ Best (eBPF) |
| Network observability | ✅ Exceptional (Hubble) |
| No iptables | ✅ kube-proxy replacement |
| Network policies | ✅ L3/L4/L7 unified |
| Service mesh | ⚠️ Per-node (not per-pod) |
| Complexity | ⚠️ eBPF expertise needed |
| K3s integration | ✅ Good (replaces flannel) |

**Best for**: High-performance bare-metal clusters, security-intensive environments, teams already investing in eBPF, multi-cluster deployments with Cluster Mesh.

---

## 📊 The Big Comparison Table

| Tool | Type | OSI Layer | K3s Default | Auto TLS | Performance | Resource Usage | Complexity |
|---|---|---|---|---|---|---|---|
| **Klipper/ServiceLB** | L4 LB | L4 | ✅ Yes | ❌ | Low | Minimal | Minimal |
| **NGINX** | Ingress | L7 | ❌ (opt-out Traefik) | ⚠️ (cert-manager) | Very High | Low | Low |
| **Traefik** | Ingress | L7 | ✅ Yes (bundled) | ✅ Built-in | High | Low | Low |
| **MetalLB** | L4 LB | L4 | ❌ | ❌ | Medium | Minimal | Low |
| **HAProxy** | Ingress | L4+L7 | ❌ | ⚠️ (cert-manager) | Highest | Low | Medium |
| **Envoy** | Proxy/Mesh DP | L4+L7 | ❌ | ✅ (with CP) | Very High | Medium | High |
| **Istio** | Service Mesh | L4+L7 | ❌ | ✅ Auto mTLS | Medium (overhead) | Very High | Very High |
| **Linkerd** | Service Mesh | L4+L7 | ❌ | ✅ Auto mTLS | High (least overhead) | Low | Low |
| **Cilium** | CNI+Mesh | L3+L4+L7 | ❌ | ✅ (WireGuard) | Highest L4 | Medium | High |

---

## 🏗️ Architecture Patterns for K3s

### Pattern 1: Minimal (Single Node / Homelab)
```
[K3s: Traefik + Klipper built-in]
   │
   └── Just works. Zero extra config needed.
```
Use when: Local dev, single-node homelab, learning Kubernetes.

### Pattern 2: Bare-Metal Production (Most Common)
```
[MetalLB] ──► External IP ──► [Traefik] ──► [Your Services]
```
Use when: Multiple K3s nodes, need proper external IPs, keep Traefik for simplicity.

### Pattern 3: High-Performance Production
```
[MetalLB] ──► External IP ──► [HAProxy Ingress] ──► [Services]
```
Use when: High RPS requirements, latency-sensitive APIs, financial/gaming workloads.

### Pattern 4: Secure Microservices (Security-First)
```
[MetalLB] ──► [NGINX/Traefik] ──► [Linkerd Mesh] ──► [Services]
                                      (mTLS, observability)
```
Use when: Multi-service architecture, compliance requirements, need service-to-service encryption.

### Pattern 5: Maximum Performance + Security (Advanced)
```
[Cilium CNI + kube-proxy replacement]
   └──► [Cilium Ingress / Envoy Gateway] ──► [Services]
        + Hubble for observability
```
Use when: eBPF expertise available, need kernel-level performance, security-intensive platform.

---

## 🏎️ Performance Benchmarks at a Glance

Based on published benchmarks and production data (2024–2026):

```
Requests per Second (RPS) at typical K8s ingress workload:

HAProxy    ████████████████████████████  42,000 RPS  (50% CPU)
Envoy      ███████████████████████████   38,000 RPS  (73% CPU)
NGINX      ██████████████████████████    35,000 RPS  (65% CPU)
Traefik    █████████████                 19,000 RPS  (45% CPU)

Service Mesh Overhead (vs no mesh):
Linkerd    ██  5–10% slower   ← Best
Cilium     ████  20–30% slower
Istio      █████  25–35% slower

L4 Raw Throughput:
Cilium (eBPF)  ████████████████████  Hardware-limited ← Best
MetalLB (BGP)  ██████████████████    Near line-rate
```

---

## 🎯 Decision Framework: Which One for Your K3s Cluster?

```
START HERE
    │
    ▼
Are you running a single node / homelab?
  YES ──► Use Klipper + Traefik (K3s defaults). You're done.
  NO
    │
    ▼
Do you need external IPs on bare metal?
  YES ──► Add MetalLB (disable Klipper first)
  NO (cloud) ──► Your cloud CCM handles this
    │
    ▼
Replace default Traefik ingress?
  Need max performance ──► HAProxy Ingress
  Need NGINX ecosystem ──► NGINX Ingress
  Happy with defaults   ──► Keep Traefik
    │
    ▼
Do you have multiple microservices needing service-to-service security?
  YES, want simplicity ──► Add Linkerd
  YES, need full features ──► Add Istio (check your RAM budget!)
  YES, eBPF expertise ──► Use Cilium as CNI + mesh
  NO ──► Skip the mesh for now
```

---

## 🔧 K3s-Specific Tips & Gotchas

1. **Traefik version**: K3s bundles Traefik. Pin the version in your HelmChartConfig if stability matters.

2. **MetalLB + Traefik**: A very common combo. MetalLB gives Traefik a real external IP. After MetalLB assigns an IP, Traefik's LoadBalancer service gets `EXTERNAL-IP` populated and starts serving traffic.

3. **Cilium on K3s**: You must disable flannel (`--flannel-backend=none`) and network policy (`--disable-network-policy`). Cilium replaces both. If you also want to replace kube-proxy, add `--disable-kube-proxy`.

4. **Linkerd on K3s**: Works out of the box. K3s's bundled components (Traefik, CoreDNS) can be meshed too — annotate the `kube-system` namespace carefully.

5. **Resource planning**: A 3-node K3s cluster with Linkerd can run comfortably on 3× Raspberry Pi 4 (4GB). Istio needs significantly more — budget at least 8GB per node.

6. **Gateway API**: The Kubernetes Gateway API is replacing Ingress. Traefik v3, HAProxy v3.1+, Envoy Gateway, and Cilium all support it. Consider Gateway API for new deployments.

---

## 🏁 Final Recommendations

| Your Situation | Recommended Stack |
|---|---|
| Homelab / learning | K3s defaults (Traefik + Klipper) |
| Bare-metal small team | MetalLB + Traefik |
| Bare-metal high traffic | MetalLB + HAProxy |
| NGINX ecosystem familiarity | MetalLB + NGINX Ingress |
| Need service mesh (simple) | MetalLB + Traefik + Linkerd |
| Need service mesh (full features) | MetalLB + Traefik + Istio (Ambient mode) |
| Max performance + security | Cilium CNI + Envoy Gateway |
| Edge/IoT K3s | Klipper + Traefik (minimal resources) |

---

## 📚 Further Reading

- [K3s Networking Docs](https://docs.k3s.io/networking/networking-services)
- [MetalLB on K3s (SUSE Edge)](https://documentation.suse.com/suse-edge)
- [Traefik K3s Configuration](https://doc.traefik.io/traefik/providers/kubernetes-crd/)
- [Linkerd Getting Started](https://linkerd.io/2.15/getting-started/)
- [Cilium K3s Setup](https://docs.cilium.io/en/stable/installation/k3s/)
- [HAProxy Kubernetes Ingress](https://www.haproxy.com/documentation/kubernetes-ingress/)
- [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/)

---

*Have questions about your specific K3s setup? Drop them in the comments. Running an unusual configuration (Raspberry Pi cluster, edge IoT, air-gapped)? I'd love to hear about it.*

*#kubernetes #k3s #devops #cloudnative #loadbalancing #traefik #nginx #metallb #linkerd #cilium*
