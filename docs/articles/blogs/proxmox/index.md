# Running k3s on Proxmox: A Multi-Node Cluster with a VM and LXC Worker — The Hard Way and Back



*A practical guide covering installation, troubleshooting, and the real story of getting k3s to run inside an LXC container*

  

---

  

## Introduction

---


Kubernetes is powerful but notorious for being heavy. k3s, the lightweight Kubernetes distribution from Rancher, fixes that. It strips out legacy APIs, bundles containerd, and ships as a single binary under 100MB. It is perfect for homelabs, edge deployments, and resource-constrained environments.
(more about k3s: [https://traefik.io/glossary/k3s-explained/](https://traefik.io/glossary/k3s-explained/?ref=adventuresintech.org))

This is the first of a series of posts describing how to bootstrap a Kubernetes cluster on [Proxmox](https://proxmox.com/?ref=adventuresintech.org) using ubuntu VM and LXC containers. By the end of the series, the aim is to have a fully working Kubernetes ([K3S](https://k3s.io/?ref=adventuresintech.org)) install including [MetalLB](https://metallb.universe.tf/?ref=adventuresintech.org) load balancer, [Gateway API](https://gateway-api.sigs.k8s.io/guides/getting-started/) controller and an Istio service mesh. I’ll also have some sample applications installed for good measure.

---

## Basically why do I need a Kubernetes cluster ?

---


At work, I’ve used large K8S clusters in production environments (AWS), clusters are abstracted away behind platform teams, which is efficient for delivery but leaves gaps in understanding how scheduling, networking, storage, and controllers really behave under the hood. Setting up your own cluster gives you that missing layer of operational intuition: you get to break things, debug them, and understand why they broke. For someone already running a fairly complex home setup, using Kubernetes as a unifying platform to experiment, whether or not you fully migrate all your Docker Compose stacks—is less about necessity and more about building practical, transferable expertise.

  


In this post I document how I built a three-node k3s cluster on Proxmox VE with:

  

-  **1 master node** — a Proxmox VM running Ubuntu

-  **1 VM worker node** — a standard Proxmox VM (worker1)

-  **1 LXC worker node** — a Proxmox LXC container (worker2)

  

The VM setup was straightforward. The LXC setup was not. This post focuses heavily on the LXC journey — the errors, the fixes, the Linux internals involved, and what it finally took to make it work.

![](https://gitea.pendela.in/bhargavasai/devops-png-svg/raw/branch/main/k3s/lxc-container/get-nodes.png)

  

---

  

## Part 1: Setting Up the Master Node

---

  

### _Installing k3s Server_

  

On the master VM, installing k3s is a single command:

  

```bash

curl  -sfL  https://get.k3s.io | sh  -

```

  

k3s sets up a systemd service, installs containerd, and bootstraps a single-node Kubernetes cluster automatically.

  

### <u>Fixing kubectl Access</u>

  

After installation, running `kubectl get nodes` immediately fails:


 `The connection to the server localhost:8080 was refused` 



  

This happens because kubectl defaults to `localhost:8080` when no kubeconfig is set. k3s stores its kubeconfig at `/etc/rancher/k3s/k3s.yaml`. The fix:

  

```bash

mkdir  -p  ~/.kube

sudo  cp  /etc/rancher/k3s/k3s.yaml  ~/.kube/config

sudo  chown  $USER:$USER  ~/.kube/config

```

  

Or export it permanently:

  

```bash

echo  'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc

source  ~/.bashrc

```

  

### Retrieve the Node Token

  

Worker nodes need a token to join the cluster. Grab it from the master:

  

```bash

sudo  cat  /var/lib/rancher/k3s/server/node-token

```

  

Keep this value — it is used in every worker join command.

  

---

  

## Part 2: Adding the VM Worker (worker1)

---

  

### _Joining the Cluster_

  

On the worker VM, run:

  

```bash

curl  -sfL  https://get.k3s.io | \

K3S_URL=https://192.168.1.44:6443  \

K3S_TOKEN=<node-token> \

sh  -

```

  

### <u>Problem: Node Password Rejected</u>

  

The agent started but immediately logged:

  

```plaintext

Node password rejected, duplicate hostname or contents of

'/etc/rancher/node/password' may not match server node-passwd entry

```

  

This happened because the worker VM had previously joined the cluster. k3s stores a node password on both the node (`/etc/rancher/node/password`) and the master (as a Kubernetes secret). When they don't match, the server rejects the node.

  

**Fix — on the worker:**

  

```bash

sudo  systemctl  stop  k3s-agent

sudo  rm  -f  /etc/rancher/node/password

sudo  rm  -rf  /var/lib/rancher/k3s/agent/

sudo  systemctl  start  k3s-agent

```

  

**Fix — on the master, delete the stale secret:**

  

```bash

kubectl  get  secrets  -n  kube-system | grep  node-password

kubectl  delete  secret  worker1.node-password.k3s  -n  kube-system

```

  

### <u>Problem: Duplicate Hostname</u>
  

Both the master and worker had the hostname `k3s`. k3s uses the hostname as the node name, so the server rejected the second node as a duplicate.

  

**Fix — rename the worker:**

  

```bash

sudo  hostnamectl  set-hostname  worker1

```

  

After renaming and cleaning up the stale secret, the worker joined successfully.

  

---

  

## Part 3: The LXC Worker — The Real Story

---

  

  

### What is an LXC Container?

  

LXC (Linux Containers) is a lightweight virtualisation technology. Unlike VMs which emulate full hardware, LXC containers share the host kernel directly. They use Linux namespaces for isolation and cgroups for resource control. They are faster and more efficient than VMs but have less isolation.

  

Proxmox LXC containers can be **privileged** (root inside = root on host) or **unprivileged** (root inside maps to a regular user on host via UID namespacing). Unprivileged is the default and more secure option.

  

### Creating the LXC Container

  

In Proxmox, I created a Debian Trixie LXC container with:

  
![](https://gitea.pendela.in/bhargavasai/devops-png-svg/raw/branch/main/k3s/lxc-container/LXC-resources.png)

  

### _Joining the Cluster_

  

```bash

curl  -sfL  https://get.k3s.io | \

K3S_URL=https://192.168.1.44:6443  \

K3S_TOKEN=<node-token> \

sh  -

```

  

The install script ran and printed `[INFO] systemd: Starting k3s-agent` — and then nothing. It just hung.

  

Checking the journal:

  

```bash

journalctl  -u  k3s-agent  -f

```

 

  

---

  

### <u>Error 1: `/dev/kmsg: no such file or directory`</u>

  

```console

Error: failed to run Kubelet: failed to create kubelet: open /dev/kmsg: no such file or directory

```

  

**What is `/dev/kmsg`?**

  

`/dev/kmsg` is the kernel message buffer device. The Linux kernel uses it to log messages (this is what `dmesg` reads). kubelet uses it to watch for OOM (Out of Memory) kill events via the `oomWatcher`. Without it, kubelet refuses to start.

  

In an unprivileged LXC container, `/dev/kmsg` does not exist because the container does not have access to kernel devices.

  

**Fix — bind mount from host:**

  

In `/etc/pve/lxc/209.conf` on the Proxmox host:

  

```conf

lxc.mount.entry: /dev/kmsg dev/kmsg none bind,create=file

```

  

This bind mounts the host's `/dev/kmsg` into the container. Stop and start (not restart) the LXC:

  

```bash

pct  stop  209

pct  start  209

```

  

---

  

### <u>Error 2: `/dev/kmsg: operation not permitted`</u>

  

After adding the bind mount, the error changed slightly:

  

```console

open /dev/kmsg: operation not permitted

```

  

The file now existed in the container but the process was not allowed to open it. The container was still running in user namespace mode (unprivileged), and AppArmor was blocking the access.

  

**Fix — disable AppArmor restriction:**

  

```conf

lxc.apparmor.profile: unconfined

```

  

AppArmor is a Linux Security Module that applies mandatory access control policies. The default Proxmox LXC AppArmor profile blocks access to kernel devices like `/dev/kmsg`. Setting it to `unconfined` removes all AppArmor restrictions for this container.

  

---

  

### <u>Error 3: `/proc/sys/kernel/panic: read-only file system`</u>

  

```console

Failed to start ContainerManager:

open /proc/sys/kernel/panic: read-only file system

open /proc/sys/kernel/panic_on_oops: read-only file system

open /proc/sys/vm/overcommit_memory: read-only file system

```

  

**What is `/proc/sys`?**

  

`/proc` is a virtual filesystem the kernel exposes so userspace can read and write kernel parameters. `/proc/sys/` specifically contains sysctl values — tuneable kernel settings.

  

kubelet needs to write to these on startup:

  

-  `kernel/panic` — configure kernel panic timeout

-  `kernel/panic_on_oops` — whether a kernel oops causes a panic

-  `vm/overcommit_memory` — memory overcommit policy

  

In an unprivileged LXC container, `/proc` is mounted read-only for safety. Any process inside the container (even root inside) cannot modify these values.

  

**Fix — mount proc and sys as read-write:**

  

```conf

lxc.mount.auto: "proc:rw sys:rw"

```

  

This tells LXC to mount `/proc` and `/sys` with read-write access instead of the default read-only.

  

---

  

### <u>Error 4: Various Permission Denied Errors</u>

  

```console

write /proc/self/oom_score_adj: permission denied

Failed to set sysctl: open /proc/sys/net/netfilter/nf_conntrack_max: permission denied

```

  

These were caused by the container still running as unprivileged — the process was root inside the container but mapped to a normal user on the host, so many privileged operations were blocked.

  

**Fix — switch to privileged container:**

  

```properties

unprivileged: 0

```

  

This is the most significant change. A privileged container maps root inside to actual root on the host. This removes the UID namespace remapping that caused most of the permission errors.

  

**Also needed:**

  

```conf

lxc.cgroup2.devices.allow: a

lxc.cap.drop:

```

  

-  `cgroup2.devices.allow: a` — allows the container access to all devices via the cgroup device controller

-  `cap.drop:` (empty) — prevents Proxmox from dropping any Linux capabilities. By default, Proxmox drops capabilities like `CAP_SYS_ADMIN`, `CAP_NET_ADMIN`, and `CAP_SYS_PTRACE` from LXC containers. k3s needs these.

  


  

### Also needed: `features: keyctl=1,nesting=1`

  

-  `keyctl=1` — enables the Linux kernel keyring inside the container. containerd uses this to securely store credentials and keys for image pulls.

-  `nesting=1` — enables nested containerisation. k3s runs containerd inside the LXC container, and containerd runs pods (more containers) inside itself. Without nesting enabled, Proxmox blocks the inner container creation.

  

---



### <u>Final Working LXC Config</u>



After applying all these changes and doing a full `pct stop` / `pct start`:

  

```bash

journalctl  -u  k3s-agent  -f

# ... containerd is now running

# ... Server ACTIVE

# ... Started kubelet

```


---

## Summary: What Each Modification Does

---
  ![](https://gitea.pendela.in/bhargavasai/devops-png-svg/raw/branch/main/k3s/lxc-container/LXC-sharing.png)



  

---
  

## Part 4: LXC as a k3s Worker — Features and Limitations

---

  

### <u>_Features / Advantages_</u>

  

**Resource efficiency** — LXC containers consume significantly less memory and CPU than VMs. A VM needs a full OS kernel in memory. An LXC container shares the host kernel, so the overhead is minimal. worker2 running k3s uses around 250–300MB RAM idle versus a VM which would use 500MB+ for the OS alone.

  

**Fast startup** — LXC containers start in 1–3 seconds versus 15–30 seconds for a VM. For ephemeral worker nodes or autoscaling scenarios this matters.

  

**Storage efficiency** — LXC uses the host filesystem directly (with a root filesystem overlay). No separate virtual disk emulation layer. I/O is closer to bare metal performance.

  

**Simple networking** — LXC containers participate in the same Proxmox bridge (`vmbr0`) as VMs. No extra networking configuration is needed for k3s to communicate between the master VM and the LXC worker.

  

**Density** — you can run more LXC containers on the same Proxmox host than VMs, making it ideal for testing multi-node cluster topologies on limited hardware.

  

### <u>_Limitations_</u>

  

**Shared kernel — no kernel version isolation** — all LXC containers on a host run the same kernel version as the host. You cannot run a different kernel inside an LXC container. This matters if you need a specific kernel feature or version for your workloads.

  

**Privileged mode is a security trade-off** — to get k3s working we had to switch to a privileged container and disable AppArmor. In a privileged container, a root escape inside the container gives root on the host. For a homelab or trusted environment this is acceptable; for production or multi-tenant setups it is a significant risk.

  

**No hardware virtualisation** — LXC containers cannot run nested VMs. If your workloads need hardware-level isolation or GPU passthrough in the container, a VM is required.

  

**Kernel module limitations** — the LXC container cannot load kernel modules that aren't already loaded on the host. During setup we saw:

```shell

modprobe: FATAL: Module br_netfilter not found

```

These modules need to be loaded on the Proxmox host, not inside the container.

  

**Some syscalls are blocked** — even in privileged mode, certain syscalls that could affect the host are restricted. This can cause subtle compatibility issues with some container workloads.

  

**Not suitable for untrusted workloads** — because the kernel is shared, a kernel exploit inside an LXC container could theoretically affect the host and all other containers. Never run untrusted code in a privileged LXC container.
  

---

  

## Conclusion

---

  

Getting k3s running on a Proxmox LXC container is absolutely possible, but it requires understanding why each restriction exists and selectively removing the ones that conflict with k3s's requirements. The journey from a blank LXC to a working cluster node touched on AppArmor, Linux capabilities, cgroups, kernel device access, namespace nesting, and virtual filesystem permissions.

  

The key takeaway: LXC containers are not VMs. They share the host kernel, and every security restriction that makes them safe is also a potential blocker for complex software like k3s that expects a full OS environment. The solution is not to blindly disable everything — it is to understand each error, trace it to the underlying Linux feature, and make the minimal change required to unblock it.

  

The final cluster — one control plane VM and two workers (one VM, one LXC) — runs stably with k3s managing scheduling, networking, and DNS across all three nodes via CoreDNS.

I now have a vanilla multi-node Kubernetes cluster running in a Ubuntu VM and an LXC container and accessible from my machine. It’s got nothing deployed inside it yet, but that’s easily fixed.... see u in part 2.



  

---

  

*Built on Proxmox VE with k3s v1.34.6+k3s1 — Debian Trixie LXC — Ubuntu VM nodes