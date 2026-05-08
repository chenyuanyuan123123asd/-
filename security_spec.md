# Security Specification for Real Estate App

## Data Invariants
1. Properties must belong to a user (`userId`).
2. Broadcast templates must belong to a user (`userId`).
3. Users can only edit/delete their own data.
4. Property IDs and Template IDs must be valid strings.

## The "Dirty Dozen" Payloads
1. **Property Creation - Missing userId**: `{ "name": "Test" }` -> DENIED
2. **Property Creation - Spoofed userId**: `{ "name": "Test", "userId": "victim_uid" }` -> DENIED
3. **Property Update - Changing userId**: `{ "userId": "attacker_uid" }` -> DENIED
4. **Property Read - Other's PII/Private**: Attempt to read property owned by another user. -> DENIED
5. **Template Creation - Missing content**: `{ "name": "T1", "userId": "my_uid" }` -> DENIED
6. **Template Creation - Oversized content**: `{ "name": "T1", "content": "a".repeat(100000) }` -> DENIED
7. **Template Update - Modifying userId**: `{ "userId": "other_uid" }` -> DENIED
8. **Template Update - Shadow Field**: `{ "content": "New", "isAdmin": true }` -> DENIED
9. **Global - Junk ID**: Attempt to write to `/properties/!!!invalid!!!` -> DENIED
10. **Global - Unauthenticated write**: write to `/properties/1` without auth. -> DENIED
11. **Global - Path Traversal**: Attempt to access `/properties/../secret` -> DENIED
12. **Global - Anonymous list**: fetch all templates without owner filter. -> DENIED

## Test Plan
- Verify that only owners can CRUD their properties and templates.
- Verify that `list` queries are restricted to ownerId.
- Verify that `createdAt` is immutable.
