#!/system/bin/sh
# These options mirror those in mozglue/build/AsanOptions.cpp
# except for fast_unwind_* which are only needed on Android
options=(
  alloc_dealloc_mismatch=0
  allocator_may_return_null=1
  allow_user_segv_handler=1
  detect_leaks=0
  fast_unwind_on_check=1
  fast_unwind_on_fatal=1
  free_fill_byte=229
  handle_sigill=1
  malloc_fill_byte=228
  max_free_fill_size=268435456
  max_malloc_fill_size=268435456
)
if [ -e "/data/local/tmp/asan.options.gecko" ]; then
  options+=("$(cat /data/local/tmp/asan.options.gecko | tr -d '\n')")
fi
LIB_PATH="$(cd "$(dirname "$0")" && pwd)"
IFS=:
export ASAN_OPTIONS="${options[*]}"
export MOZ_DEBUG_LINKER=1
export LD_PRELOAD="$(ls "$LIB_PATH"/libclang_rt.asan-*-android.so)"
exec "$@"
