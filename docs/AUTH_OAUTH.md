# Google / KakaoTalk 로그인 연동 (Supabase OAuth)

로그인 페이지에서 Google·KakaoTalk 버튼은 Supabase OAuth를 사용합니다.  
아래 설정을 완료해야 버튼이 동작합니다.

---

## 공통: Supabase Redirect URL 등록

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **URL Configuration**
3. **Redirect URLs**에 다음을 추가 (이미 있으면 생략):
   - `https://undongjang.vercel.app/**` (프로덕션)
   - `http://localhost:3000/**` (로컬)
   - Preview용이면 `https://*.vercel.app/**` 추가해도 됨

---

## 1. Google 로그인

### Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택 또는 생성
2. **APIs & Services** → **OAuth consent screen**
   - User Type: **External** (테스트용이면 테스트 사용자 추가)
   - **App domain**: `supabase.co` 등 필요 시 추가
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**에 추가:
     - `https://undongjang.vercel.app`
     - `http://localhost:3000`
   - **Authorized redirect URIs**에 **반드시** 추가:
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
     - (Supabase Dashboard → Authentication → Providers → Google 에서 복사 가능)

4. 생성된 **Client ID**와 **Client Secret** 복사

### Supabase

1. **Authentication** → **Providers** → **Google** 활성화
2. **Client ID**: `661994738657-rbs9s6h3vtlh7lcqhguoadq2jauncas9.apps.googleusercontent.com` (또는 본인 콘솔에서 복사)
3. **Client Secret**: Google Cloud Console에서 복사한 값 붙여넣기 → **Save**

이후 로그인/회원가입 페이지의 **Google** 버튼이 동작합니다.

---

## 2. KakaoTalk 로그인

### Kakao Developers

1. [Kakao Developers](https://developers.kakao.com/) 로그인 → **내 애플리케이션**
2. 애플리케이션 추가 또는 기존 앱 선택
3. **앱 키**에서 **REST API 키** 복사 (Client ID로 사용)
4. **카카오 로그인** → **활성화 설정** ON
5. **카카오 로그인** → **Redirect URI**에 등록:
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
6. **동의항목**에서 필요한 항목(프로필, 이메일 등) 활성화
7. **카카오 로그인** → **보안**에서 **Client Secret** 생성 후 복사 (Supabase에서 요구 시)

### Supabase

1. **Authentication** → **Providers** → **Kakao** 활성화
2. **Client ID** = Kakao REST API 키  
   **Client Secret** = Kakao에서 발급한 Client Secret (없으면 비워두고 Supabase 문서 확인)
3. Save

이후 로그인 페이지의 **KakaoTalk** 버튼이 동작합니다.

---

## 참고

- 프로젝트 ref 확인: Supabase Dashboard URL이 `https://supabase.com/dashboard/project/XXXXX` 일 때 `XXXXX`가 project ref입니다.  
  콜백 URL은 `https://XXXXX.supabase.co/auth/v1/callback` 입니다.
- OAuth 후 로그인한 사용자는 Supabase `auth.users`에 생성되며, `handle_new_user` 트리거로 `public.users`에 프로필이 생성됩니다. 소셜 로그인 사용자는 이메일 등이 provider에서 옵니다.
