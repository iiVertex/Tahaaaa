<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 4e695514-877a-4895-aa5f-78c037914e89 -->
# Fix duplicate exports in src/lib/api.ts

We will resolve the build errors by keeping the validated, consolidated implementations and removing accidental duplicate exports appended at the bottom of the file.

## Changes
- Remove the second duplicated blocks for these functions:
  - `getRewards`, `redeemReward`
  - `getSocialFeed`
  - `getProfile`, `updateProfile`
- Keep the earlier versions that use `request(...)` and zod schemas.

## Target file
- `src/lib/api.ts`

## Edit (remove these duplicate sections)
Delete the duplicate export blocks starting from the second "// Rewards" section downwards:

```startLine:endLine:src/lib/api.ts
70:136:// Rewards
72:79:export async function getRewards() {
74:76:  const { data } = await api.get('/rewards');
76:77:  return data?.data?.rewards || data?.data || data;
80:86:export async function redeemReward(id: string) {
82:84:  const { data } = await api.post('/rewards/redeem', { rewardId: id });
84:85:  return data;
90:110:// Social
95:109:export async function getSocialFeed() {
99:105:  const [friends, leaderboard] = await Promise.all([
101:103:    api.get('/social/friends'),
103:104:    api.get('/social/leaderboard'),
105:107:  ]);
107:108:  return { friends: friends.data?.data?.friends || [], leaderboard: leaderboard.data?.data?.leaderboard || [] };
113:129:// Profile
115:121:export async function getProfile() {
117:119:  const { data } = await api.get('/profile');
119:120:  return data?.data || data;
123:129:export async function updateProfile(payload: any) {
125:127:  const { data } = await api.put('/profile', payload);
127:128:  return data;
```

After deletion, the file should end at the first set of `updateProfile` (line ~65) with no further duplicates.

## Verify
- Run `npm run dev` and confirm Vite starts without duplicate export errors.
- Smoke test affected calls (Rewards, Social, Profile) in the UI.


### To-dos

- [ ] Delete duplicate exports in src/lib/api.ts to resolve build errors
- [ ] Run dev build and verify no duplicate export errors