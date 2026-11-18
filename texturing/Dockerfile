# Ubuntu 20.04 ships classic TBB with task_scheduler_init.h, used by this fork.
FROM ubuntu:20.04
ARG DEBIAN_FRONTEND=noninteractive
ARG JOBS=4
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates build-essential cmake git libpng-dev libjpeg-dev libtiff-dev libtbb-dev \
    && rm -rf /var/lib/apt/lists/*
COPY vendor/mvs-texturing /src
RUN test -f /usr/include/tbb/task_scheduler_init.h \
    && cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /build --target texrecon --parallel "${JOBS}" \
    && install -m 755 /build/apps/texrecon/texrecon /usr/local/bin/texrecon
ENTRYPOINT ["texrecon"]
