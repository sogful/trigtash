set -e
ROOT=/h/Users/Admin/Downloads/tdrecovery
FF=$ROOT/dependencies/ffmpeg
SIDECAR=$ROOT/dependencies/tauri/src-tauri/binaries/ffmpeg.exe

echo "installing toolchain (pacman)..."
pacman -S --needed --noconfirm \
  mingw-w64-x86_64-gcc mingw-w64-x86_64-x264 mingw-w64-x86_64-nasm \
  mingw-w64-x86_64-pkgconf make diffutils

cd "$FF"
echo "configuring (minimal, static)..."
make distclean >/dev/null 2>&1 || true
./configure \
  --disable-everything --disable-doc --disable-debug --disable-network --disable-autodetect \
  --disable-ffprobe --disable-ffplay \
  --enable-gpl --enable-libx264 --enable-small \
  --enable-protocol=file,pipe \
  --enable-demuxer=rawvideo,wav,mov \
  --enable-muxer=mp4 \
  --enable-decoder=rawvideo,pcm_s16le,pcm_f32le \
  --enable-encoder=libx264,aac \
  --enable-parser=h264,aac \
  --enable-filter=scale,format,aresample,aformat,anull,null \
  --enable-bsf=aac_adtstoasc \
  --enable-swscale --enable-swresample \
  --extra-ldflags="-static" --pkg-config-flags="--static"

echo "building..."
make -j"$(nproc)"

echo "stripping + placing sidecar.."
strip ffmpeg.exe
mkdir -p "$(dirname "$SIDECAR")"
cp -f ffmpeg.exe "$SIDECAR"
echo "sizes:"; ls -lh ffmpeg.exe "$SIDECAR"
echo "done! ffmpeg should be very lightweight now"
