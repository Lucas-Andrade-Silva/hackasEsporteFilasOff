import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e",fullyParallel:false,workers:1,retries:0,
 timeout:30000,reporter:"list",
 use:{baseURL:"http://localhost:3000",trace:"retain-on-failure"},
 projects:[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"mobile-emulation",use:{...devices["Pixel 7"],defaultBrowserType:"chromium"}}],
 webServer:{command:"npm run start",url:"http://localhost:3000/api/demo",timeout:60000,reuseExistingServer:false,env:{ENABLE_PRIVATE_CAPTURE:"false",SUPABASE_URL:"",SUPABASE_SERVICE_ROLE_KEY:"",NEXT_PUBLIC_SUPABASE_URL:"",NEXT_PUBLIC_SUPABASE_ANON_KEY:""}}
});
