#!/usr/bin/env bash
# Check if gitleaks is installed, print install instructions if not

if command -v gitleaks >/dev/null 2>&1; then
  echo "✅ gitleaks $(gitleaks version 2>/dev/null || echo 'installed')"
  exit 0
fi

echo ""
echo "⚠️  gitleaks is not installed"
echo ""
echo "Dirigent uses gitleaks for secret detection in pre-commit hooks"
echo "and security scans. Install it to enable secret scanning:"
echo ""

case "$(uname -s)" in
  Darwin*)
    echo "  brew install gitleaks"
    ;;
  Linux*)
    echo "  # Option 1: Download binary"
    echo "  curl -sSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_x64.tar.gz | sudo tar -xz -C /usr/local/bin/"
    echo ""
    echo "  # Option 2: Go install"
    echo "  go install github.com/gitleaks/gitleaks/v8@latest"
    ;;
  *)
    echo "  See: https://github.com/gitleaks/gitleaks#installing"
    ;;
esac

echo ""
echo "Without gitleaks, secret scanning will be skipped (hooks won't block)."
echo ""
