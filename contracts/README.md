# the capsule honor badges – Contracts

- Upgradeable ERC-1155 (UUPS) for achievement badges
- 1-per-user-per-achievement, optional soulbound per id
- Server-signed EIP-712 minting

## Setup

```bash
cd contracts
npm i
```

## Compile

```bash
npm run build
```

## Deploy (local)

```bash
ADMIN=0x... SIGNER=0x... BASE_URI=https://example.com/achievements/ npx hardhat run scripts/deploy.ts --network localhost
```

The proxy address is printed on success.

## Storage layout & upgrades

- Uses OpenZeppelin UUPS. Guard upgrades with `UPGRADER_ROLE`.
- Append-only storage. Do not reorder existing vars.