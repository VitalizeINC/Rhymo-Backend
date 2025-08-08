import authController from '../app/http/api/controllers/authController.js';

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      console.log('STATUS:', this.statusCode);
      console.log('RESPONSE:', JSON.stringify(payload, null, 2));
      return this;
    },
  };
}

async function main() {
  const req = {
    body: {
      authorizationCode: 'c818792e4d38a4d4b904e3a76b378aaec.0.suqw.z9iWtVViQ6TX6wyg2S_j8g',
      email: null,
      fullName: {
        familyName: null,
        givenName: null,
        middleName: null,
        namePrefix: null,
        nameSuffix: null,
        nickname: null,
      },
      identityToken:
        'eyJraWQiOiJVYUlJRlkyZlc0IiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJodHRwczovL2FwcGxlaWQuYXBwbGUuY29tIiwiYXVkIjoiaG9zdC5leHAuRXhwb25lbnQiLCJleHAiOjE3NTQ3NTc4OTYsImlhdCI6MTc1NDY3MTQ5Niwic3ViIjoiMDAwNDA2LjE0NWI1NzI1YzFjOTQ4NmFhMGMxZDBiYWE2MTU5NTJiLjE2MzkiLCJjX2hhc2giOiJwVkZRclRyRlNxd0NFRTEzM19ZNUpnIiwiZW1haWwiOiJxa2g1eXd5aGNuQHByaXZhdGVyZWxheS5hcHBsZWlkLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc19wcml2YXRlX2VtYWlsIjp0cnVlLCJhdXRoX3RpbWUiOjE3NTQ2NzE0OTYsIm5vbmNlX3N1cHBvcnRlZCI6dHJ1ZX0.TSXh8y5lmzu2NUaZcHq2DxDyC5zrXz5UsYWIm6LUqldGTrg5yW9qsJ2OsNy7eS1p52JCm2W1CcuRMqwVEijL7pmzavsD1GmBJ9Il6HPGrd3WmJJy_dZglR5xD6B4cZH1w250SVtwNtce3Uo0HfwDT-6Emx3d3rxuIOXsZnn4j8oaA24CikOhPU3gDWJInwO3ackZ1XCq8h1hC16GAw_nqs5j3ylnOw_3GdAbf1urZ1uf4NIpXXLJbSMK-h6Hl20tc_3byeS5VWFmmFCJB9NEviNEyFD5OCSyOkO0Ufe-f-NH70Li7Cjf4uQgpQdeIVWvRdGVACoSyjMXVf2KUuri_A',
      realUserStatus: 1,
      state: null,
      user: '000406.145b5725c1c9486aa0c1d0baa615952b.1639',
    },
  };

  const res = createMockRes();
  await authController.appleLogin(req, res, () => {});
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});


