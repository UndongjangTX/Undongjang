# Vercel 배포 가이드 (무료 플랜 + 스테이징)

Next.js 프로젝트를 Vercel 무료(Hobby) 플랜으로 배포하고, 스테이징용 브랜치를 사용하는 방법입니다.

---

## 1. 직접 해야 할 것 (스텝 바이 스텝)

### Step 1. Vercel 계정 만들기

1. [vercel.com](https://vercel.com) 접속
2. **Sign Up** → **Continue with GitHub** (또는 GitLab/Bitbucket) 선택
3. GitHub 권한 허용 후 로그인 완료 

### Step 2. 프로젝트 Import (첫 배포)

1. Vercel 대시보드에서 **Add New…** → **Project**
2. **Import Git Repository**에서 이 저장소(`undongjang`) 선택  
   - 안 보이면 **Configure GitHub App**에서 저장소 접근 권한 추가
3. **Import** 클릭
4. 설정 확인:
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: `./` (그대로)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: 비움 (Next.js 기본)
5. **Environment Variables** 섹션으로 이동 (다음 Step에서 추가)
6. **Deploy** 클릭 → 첫 빌드 시작 (env 없어도 빌드는 됨, 런타임에서 Supabase 필요)

### Step 3. 환경 변수 설정 (필수)

배포된 사이트가 Supabase에 연결되려면 다음 변수를 넣어야 합니다.

1. Vercel 프로젝트 → **Settings** → **Environment Variables**
2. 아래 변수 추가 (로컬 `.env.local`에 있는 값 사용):

| Name | Value | Environment |
|------|--------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Production, Preview, Development 모두 체크 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key | Production, Preview, Development 모두 체크 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API 키 (이벤트 지도) | Production, Preview, Development 모두 체크 (선택) |

3. **Save** 후, **반드시 Redeploy**:
   - **Deployments** 탭 → 가장 위 배포 클릭 → 오른쪽 **⋯** 메뉴 → **Redeploy** → **Redeploy** 확인
   - `NEXT_PUBLIC_*` 값은 **빌드 시점**에 번들에 들어가므로, 변수 추가만 하고 Redeploy를 하지 않으면 사이트에는 반영되지 않습니다.

> Supabase: [Dashboard](https://supabase.com/dashboard) → 프로젝트 → **Settings** → **API** 에서 URL과 `anon` `public` 키 확인

### Step 4. 스테이징용 브랜치 사용 (무료 플랜)

무료 플랜에는 "Staging"이라는 전용 환경 이름은 없고, **Preview 배포**로 스테이징을 씁니다.

- **Production**: `main` 브랜치 푸시 → `xxx.vercel.app` (프로덕션 도메인)
- **스테이징**: `staging`(또는 다른) 브랜치 푸시 → 자동으로 Preview URL 생성  
  예: `undongjang-git-staging-username.vercel.app`

**스테이징 브랜치 만들기:**

```bash
git checkout -b staging
git push -u origin staging
```

이후 `staging`에 push할 때마다 Vercel이 자동으로 빌드하고, **Deployments**에 Preview URL이 생깁니다.  
그 URL을 "스테이징 환경"으로 사용하면 됩니다.

- 스테이징에도 같은 env를 쓰려면 Step 3에서 **Preview**에 체크했는지 확인하세요.

### Step 5. (선택) 커스텀 도메인

- **Settings** → **Domains**에서 `xxx.vercel.app` 대신 자신의 도메인 연결 가능  
- 무료 플랜에서도 기본 제공 도메인은 그대로 사용 가능

---

## 2. 저장소에 이미 포함된 것

- **Next.js**: Vercel이 자동으로 감지하여 빌드/실행
- **`.gitignore`**: `.vercel`, `.env*.local` 포함되어 있어 로컬/연결 정보가 올라가지 않음
- **이 문서**: `docs/DEPLOYMENT.md`

---

## 3. 요약 체크리스트

- [ ] Vercel 계정 생성 (GitHub 연동)
- [ ] 저장소 Import → 첫 Deploy
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 (Production + Preview)
- [ ] 필요 시 Redeploy
- [ ] 스테이징용 브랜치(`staging`) 생성 후 push → Preview URL을 스테이징으로 사용

테스팅 기간에는 위 설정만으로 무료 플랜으로 충분히 사용할 수 있습니다.
