#!/bin/bash

set -e

###############
# ARGUMENTS
###############


usage() {
	echo "Usage:

	./build/gdc/build.sh [-t] [-r]

	-t tpmasterdir: your local serverconfig.json's tpmasterdir
	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "t:r:h:d:" opt; do
	case "${opt}" in
	t) 
		TPMASTERDIR=$OPTARG
		;;
	r)
		REV=$OPTARG
		;;
	d)
		DOCKER_TAG=$OPTARG
		;;
	h)
		usage
		exit 1
		;;
	esac
done

#if [[ "$TPMASTERDIR" == "" ]]; then
#	echo "Missing the -t argument"
#	usage
#	exit 1
#fi

##################################
# Create a full, testable build
##################################

# ./build/full/build.sh -r $REV

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh -r $REV -t gdc
REV=$(cat tmppack/rev.txt)

#####################
# Build the image
#####################

cd tmppack
# get the current tag
# GIT_TAG is set when the script is kicked off by GDC Jenkins
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"

# delete this test step once the gdc wrapper tests are 
# triggered as part of the image building process
#./build/gdc/dockrun.sh $TPMASTERDIR 3456 ppgdctest:$REV
#if [[ "$?" != "0" ]]; then
#	echo "Error when running the GDC test image (exit code=$?)"
#	exit 1
#fi

# this image
# - will extract a subset of files from the full Docker image
# - may publish the @stjude-proteinpaint client package
docker build \
	--file ./build/gdc/Dockerfile \
	--target ppserver \
	--tag ppgdc:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.
