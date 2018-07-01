const Lang           = imports.lang;
const GObject        = imports.gi.GObject;
const Gio            = imports.gi.Gio;
const Gtk            = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Convenience    = Me.imports.convenience;

/* 
 * Prefs implementation from 'Unite' extension 
 * https://github.com/hardpixel/unite-shell
 */
 
var PrefsWidget = new GObject.Class({
  Name: 'Me.PrefsWidget',
  GTypeName: 'PrefsWidget',
  Extends: Gtk.Box,

  _init: function(params) {
    this.parent(params);

    this._buildable = new Gtk.Builder();
    this._buildable.add_from_file(Me.path + '/settings.ui');

    let prefsWidget = this._getWidget('prefs_widget');
    this.add(prefsWidget);

    this._settings = Convenience.getSettings();
    this._bindBooleans();
    this._bindEnumerations();
  },

  _getWidget: function(name) {
    let wname = name.replace(/-/g, '_');
    return this._buildable.get_object(wname);
  },

  _getBooleans: function () {
    let items = [
      'hide-dotfiles'
    ];

    return items;
  },

  _bindBoolean: function (setting) {
    let widget = this._getWidget(setting);
    this._settings.bind(setting, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
  },

  _bindBooleans: function () {
    this._getBooleans().forEach(Lang.bind(this, this._bindBoolean));
  },

  _getEnumerations: function () {
    let items = [ ];

    return items;
  },

  _bindEnumeration: function (setting) {
    let widget = this._getWidget(setting);
    widget.set_active(this._settings.get_enum(setting));

    widget.connect('changed', Lang.bind (this, function(combobox) {
      this._settings.set_enum(setting, combobox.get_active());
    }));
  },

  _bindEnumerations: function () {
    this._getEnumerations().forEach(Lang.bind(this, this._bindEnumeration));
  }
});

function init() {
  Convenience.initTranslations();
}

function buildPrefsWidget() {
  let widget = new PrefsWidget();
  widget.show_all();

  return widget;
}
