# Maintainer: Stefano Capitani <stefano@manjaro.org>

_pkgbase=gnome-shell-extension-desktop-icons
pkgname=$_pkgbase-reworked
pkgver=0.1
pkgrel=1
_commit=77e5048bc972b7fe2f7049c54cd3464d770c323a
pkgdesc="Add icons to the desktop"
arch=('any')
url="https://github.com/Ste74/org.gnome.desktop-icons-reworked"
license=("LGPL3")
depends=('gnome-shell' 'gnome-shell-extensions')
conflicts=("$_pkgbase")
options=('!strip')
source=("$url/archive/$_commit.tar.gz")
sha512sums=('8894b6325fdce220078eff04e7c9d2d5aefaf0b2867b733076bfd4b945e8e7dcbf9d8338945a94ed8dbedf88d33fa3d93094fa720edcefb693ae0512c82fc861')

build() {
    mkdir -p ${srcdir}/build
    cd ${srcdir}/build
    cmake ../${pkgname}
    make
}

package() {
    make -C build DESTDIR="${pkgdir}" install
}
