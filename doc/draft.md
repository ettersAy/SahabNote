the deployment pass :
```

 [notice] A new release of pip is available: 25.3 -> 26.0.1
 [notice] To update, run: pip install --upgrade pip
 Uploading build...
 Uploaded in 6.7s. Compression took 3.0s
 Build successful 🎉
 Deploying...
 Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
 Running 'cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT'
 Your service is live 🎉

Available at your primary URL https://sahabnote.onrender.com
```
when I open the url `https://sahabnote.onrender.com/api/health` I have this :
```
{"status":"ok","service":"sahabnote-api","version":"1.0.0"}
```

---

create a small ui widget that will call  `https://sahabnote.onrender.com/api/health` and it stay green or red if it's not working, My os is linux mint, choose the tech or language that is not heavy because my laptop is not powerful

