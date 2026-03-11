#!/bin/bash
# EMFILEエラー対策: ファイル監視の上限を一時的に上げる（macOS）
ulimit -n 10240 2>/dev/null || true
npm run dev
