#!/usr/bin/env bash
# wait-rollout.sh — Poll a Kubernetes rollout, force-deleting stuck Terminating
# pods so that node-degraded scenarios don't stall the whole pipeline.
#
# Usage:
#   wait-rollout.sh <deployment-name> <label-selector> <namespace>
#
# Example:
#   wait-rollout.sh oms-backend app=oms-backend oms-nest-staging
#
# Exit codes:
#   0  — rollout completed successfully
#   1  — rollout did not complete within 600 s
set -euo pipefail

DEPLOYMENT="${1:?deployment-name is required}"
LABEL_SELECTOR="${2:?label-selector is required (e.g. app=oms-backend)}"
NS="${3:?namespace is required}"

deadline=$(( SECONDS + 600 ))

while [ $SECONDS -lt $deadline ]; do
  remaining=$(( deadline - SECONDS ))
  window=$(( remaining < 60 ? remaining : 60 ))

  if kubectl rollout status "deployment/${DEPLOYMENT}" -n "${NS}" --timeout="${window}s"; then
    echo "deployment/${DEPLOYMENT} rolled out successfully"
    exit 0
  fi

  stuck=$(kubectl get pods -n "${NS}" -l "${LABEL_SELECTOR}" \
    -o jsonpath='{range .items[?(@.metadata.deletionTimestamp!="")]}{.metadata.name}{"\n"}{end}')

  if [ -n "${stuck}" ]; then
    echo "Force-deleting Terminating pod(s): ${stuck}"
    echo "${stuck}" | xargs -r -n1 kubectl delete pod -n "${NS}" --force --grace-period=0 || true
  else
    echo "Rollout not complete yet, no Terminating pods to reap; retrying"
  fi
done

echo "::error::deployment/${DEPLOYMENT} rollout did not complete within 600s"
echo "::group::Pods (wide)"
kubectl get pods -n "${NS}" -l "${LABEL_SELECTOR}" -o wide || true
echo "::endgroup::"
echo "::group::Deployment describe"
kubectl describe "deployment/${DEPLOYMENT}" -n "${NS}" || true
echo "::endgroup::"
echo "::group::ReplicaSets"
kubectl get rs -n "${NS}" -l "${LABEL_SELECTOR}" -o wide || true
echo "::endgroup::"
echo "::group::Pod describe (with Events)"
for pod in $(kubectl get pods -n "${NS}" -l "${LABEL_SELECTOR}" -o jsonpath='{.items[*].metadata.name}'); do
  echo "----- ${pod} -----"
  kubectl describe pod "${pod}" -n "${NS}" || true
done
echo "::endgroup::"
echo "::group::Recent namespace events"
kubectl get events -n "${NS}" --sort-by=.lastTimestamp | tail -60 || true
echo "::endgroup::"
echo "::group::Pod logs (current + previous)"
for pod in $(kubectl get pods -n "${NS}" -l "${LABEL_SELECTOR}" -o jsonpath='{.items[*].metadata.name}'); do
  echo "----- ${pod} logs (current, tail 200) -----"
  kubectl logs -n "${NS}" "${pod}" --tail=200 --all-containers || true
  echo "----- ${pod} logs (previous, tail 200) -----"
  kubectl logs -n "${NS}" "${pod}" --previous --tail=200 --all-containers || true
done
echo "::endgroup::"
echo "::group::Nodes hosting these pods"
nodes=$(kubectl get pods -n "${NS}" -l "${LABEL_SELECTOR}" \
  -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort -u)
for node in ${nodes}; do
  [ -z "${node}" ] && continue
  echo "----- ${node} -----"
  kubectl describe node "${node}" | sed -n '/^Conditions:/,/^[A-Z]/p' || true
done
echo "::endgroup::"
exit 1
