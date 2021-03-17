#!/bin/bash

set -e

# TODO We could remove the need for this custom build script if we tweaked
# the GDC build pipeline to allow changing the Dockerfile location.

DOCKER_TAG="${REGISTRY}/ncigdc/${REPO}:${GIT_TAG}"

# Enable buildkit to skip building unneeded stages.
export DOCKER_BUILDKIT=1

docker build \
	--build-arg http_proxy=http://cloud-proxy:3128 \
	--build-arg https_proxy=http://cloud-proxy:3128 \
	-f build/Dockerfile.gdc \
	-t "$DOCKER_TAG" \
	.

docker push "$DOCKER_TAG"

docker rmi "$DOCKER_TAG"

docker system prune -f --volumes
