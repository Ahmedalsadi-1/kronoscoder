# KronosCode Scalability Status

## Current Architecture: Single-Node Only

### Database Layer
- **SQLite** - File-based, single-writer database
- **No distributed locking** - Takeover leases are local to single process
- **No replication** - Data loss risk on node failure

### Queue System
- **Bull + Redis** - Supports horizontal scaling
- **Job processing** - Can run on multiple workers
- **State persistence** - Redis-backed, survives restarts

### Session Management
- **DB-backed state** - Session state stored in SQLite
- **Heartbeat monitoring** - In-process timers (not distributed)
- **Lock expiration** - Queue-based, can run on any worker

## Scalability Limitations

### ❌ Cannot Scale Horizontally (Current State)
1. **SQLite write contention** - Multiple instances would corrupt database
2. **File-based storage** - No shared filesystem across nodes
3. **In-process monitoring** - Heartbeat checks tied to single process

### ✅ Can Scale Horizontally (With Migration)
1. **Migrate to PostgreSQL** - Multi-writer support
2. **Distributed locks** - Use Redis or Postgres advisory locks
3. **Shared storage** - S3 or network filesystem for artifacts
4. **Stateless API layer** - Already achieved with queue-based provisioning

## Current Deployment Model

### Supported
- **Single server** - All components on one machine
- **Vertical scaling** - Add more CPU/RAM to single node
- **Queue workers** - Multiple worker processes on same node

### Not Supported
- **Multi-instance API** - Would cause database corruption
- **Load balancing** - No session affinity, no shared state
- **High availability** - No failover, no replication

## Migration Path to Horizontal Scalability

### Phase 1: Database Migration
- [ ] Replace SQLite with PostgreSQL
- [ ] Update Drizzle schema for Postgres
- [ ] Migrate existing data
- [ ] Test multi-writer scenarios

### Phase 2: Distributed Locking
- [ ] Implement Redis-based takeover locks
- [ ] Replace in-process heartbeat with distributed monitoring
- [ ] Add lock renewal mechanism

### Phase 3: Stateless API
- [ ] Remove any in-memory state from API layer
- [ ] Move all state to database or Redis
- [ ] Implement session affinity or sticky sessions

### Phase 4: High Availability
- [ ] Add database replication
- [ ] Implement health checks and failover
- [ ] Add load balancer configuration

## Current Status: **Single-Node Only**

**Do not deploy multiple instances of the API server.**

The system is designed for:
- Development environments
- Small teams (< 50 users)
- Internal testing
- Proof-of-concept deployments

For production scale, complete the migration path above.

## Performance Characteristics

### Current Limits (Single Node)
- **Concurrent sessions**: ~100 (limited by SQLite write throughput)
- **API throughput**: ~1000 req/s (limited by single process)
- **Queue processing**: ~50 jobs/s (limited by worker count)

### After Postgres Migration
- **Concurrent sessions**: ~10,000 (limited by connection pool)
- **API throughput**: ~10,000 req/s (with 10 instances)
- **Queue processing**: ~500 jobs/s (with distributed workers)

---

**Last Updated**: 2026-03-07  
**Status**: Single-Node Architecture  
**Next Milestone**: PostgreSQL Migration
