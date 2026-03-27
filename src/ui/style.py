"""
Hoja de estilos global  ·  tokens papel/tinta (tienda de escritorio, no admin genérico).
Menús y barra de estado claros; foco visible en controles.
"""
from src.ui.tokens import *

APP_QSS = f"""
/* ═══════════════════════════════════════════
   BASE  ·  shell tipo Zen (fondo apagado + contenido legible)
═══════════════════════════════════════════ */
* {{
    font-family: {FONT_FAMILY};
    font-size:   9pt;
}}

QWidget {{
    background: {BG_SHELL};
    color:      {TEXT_BODY};
}}

QMainWindow {{
    background: {BG_SHELL};
}}

/* ═══════════════════════════════════════════
   MENU BAR  (claro, papel + línea tinta)
═══════════════════════════════════════════ */
QMenuBar {{
    background: {BG_SHELL};
    color:      {TEXT_BODY};
    font-size:  8pt;
    min-height: 22px;
    padding:    0 0;
    border:     none;
    border-bottom: 1px solid rgba(45, 42, 38, 0.08);
    spacing:    0;
}}
QMenuBar::item {{
    background: transparent;
    padding:    {SPACE_HALF}px {SPACE_2}px;
}}
QMenuBar::item:selected {{
    background: {PRIMARY_PALE};
    color:      {PRIMARY};
}}
QMenuBar::item:pressed {{
    background: {PRIMARY_LIGHT};
    color:      {PRIMARY_HOVER};
}}

QMenu {{
    background:    {BG_CONTENT};
    color:         {TEXT_STRONG};
    border:        1px solid rgba(55, 50, 45, 0.1);
    border-radius: {RADIUS_MD}px;
    padding:       {SPACE_HALF}px 0;
}}
QMenu::item {{
    padding:    {SPACE_1}px {SPACE_3}px {SPACE_1}px {SPACE_2}px;
    font-size:  9pt;
}}
QMenu::item:selected {{
    background:    {PRIMARY_PALE};
    color:         {TEXT_STRONG};
    border-radius: 2px;
}}
QMenu::separator {{
    height:     1px;
    background: {DIVIDER};
    margin:     {SPACE_HALF}px {SPACE_2 - 4}px;
}}

/* ═══════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════ */
QFrame#Sidebar {{
    background:  {BG_SIDEBAR};
    border-right: 1px solid rgba(45, 42, 38, 0.08);
}}

/* ═══════════════════════════════════════════
   STACKED / CONTENIDO
═══════════════════════════════════════════ */
QStackedWidget {{
    background: transparent;
}}

/* ═══════════════════════════════════════════
   INPUTS DE TEXTO
═══════════════════════════════════════════ */
QLineEdit, QTextEdit, QPlainTextEdit {{
    background:    {BG_CONTENT};
    border:        1px solid {BORDER_MED};
    border-radius: {RADIUS_MD}px;
    padding:       {SPACE_HALF + 1}px {SPACE_1}px;
    color:         {TEXT_STRONG};
    selection-background-color: {PRIMARY_LIGHT};
    selection-color:            {TEXT_STRONG};
    min-height:    {CONTROL_MIN_H}px;
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border:     {FOCUS_BORDER_W}px solid {PRIMARY};
    background: {BG_CONTENT};
}}
QLineEdit:hover:!focus, QTextEdit:hover:!focus, QPlainTextEdit:hover:!focus {{
    border-color: {BORDER_MED};
}}
QLineEdit[readOnly="true"] {{
    background: rgba(245, 244, 242, 0.9);
    color:      {TEXT_MUTED};
}}

/* ═══════════════════════════════════════════
   COMBO / FECHA / SPIN
═══════════════════════════════════════════ */
QComboBox, QDateEdit, QSpinBox, QDoubleSpinBox {{
    background:    {BG_CONTENT};
    border:        1px solid {BORDER_MED};
    border-radius: {RADIUS_MD}px;
    padding:       {SPACE_HALF + 1}px {SPACE_1}px;
    padding-right: {SPACE_3}px;
    color:         {TEXT_STRONG};
    min-height:    {CONTROL_MIN_H}px;
}}
QComboBox:focus, QDateEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
    border:     {FOCUS_BORDER_W}px solid {PRIMARY};
    background: {BG_CONTENT};
}}
QComboBox::drop-down {{
    border: none;
    width: {SPACE_2}px;
}}
QComboBox QAbstractItemView {{
    border: 1px solid {BORDER_MED};
    border-radius: {RADIUS_SM}px;
    selection-background-color: {PRIMARY_LIGHT};
    selection-color: {TEXT_STRONG};
    padding: {SPACE_HALF}px;
}}

/* ═══════════════════════════════════════════
   SCROLLBAR
═══════════════════════════════════════════ */
QScrollArea   {{ background: transparent; border: none; }}
QScrollBar:vertical {{
    background:    transparent;
    width:         {SCROLLBAR_TRACK_W}px;
    margin:        0;
    border:        none;
}}
QScrollBar::handle:vertical {{
    background:    {SCROLLBAR_HANDLE};
    border-radius: 2px;
    min-height:    {SCROLLBAR_HANDLE_MIN}px;
    margin:        0;
}}
QScrollBar::handle:vertical:hover  {{ background: {SCROLLBAR_HANDLE_HOVER}; }}
QScrollBar::add-page:vertical,
QScrollBar::sub-page:vertical      {{ background: transparent; }}
QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical      {{ height: 0; width: 0; }}

QScrollBar:horizontal {{
    background:    transparent;
    height:        {SCROLLBAR_TRACK_W}px;
    margin:        0;
    border:        none;
}}
QScrollBar::handle:horizontal {{
    background:    {SCROLLBAR_HANDLE};
    border-radius: 2px;
    min-width:     {SCROLLBAR_HANDLE_MIN}px;
    margin:        0;
}}
QScrollBar::handle:horizontal:hover {{ background: {SCROLLBAR_HANDLE_HOVER}; }}
QScrollBar::add-page:horizontal,
QScrollBar::sub-page:horizontal     {{ background: transparent; }}
QScrollBar::add-line:horizontal,
QScrollBar::sub-line:horizontal     {{ width: 0; height: 0; }}

/* ═══════════════════════════════════════════
   BOTONES
═══════════════════════════════════════════ */
QPushButton {{
    background:    {BG_CONTENT};
    border:        1px solid {BORDER_MED};
    border-radius: {RADIUS_MD}px;
    padding:       {SPACE_HALF + 1}px {SPACE_2}px;
    color:         {TEXT_BODY};
    min-height:    {CONTROL_MIN_H}px;
}}
QPushButton:focus {{
    border: {FOCUS_BORDER_W}px solid {PRIMARY};
}}
QPushButton:hover  {{
    background: {PRIMARY_PALE};
    border-color: {PRIMARY};
    color: {TEXT_STRONG};
}}
QPushButton:pressed {{
    background: {PRIMARY_LIGHT};
    padding-top: {SPACE_1 - 2}px;
}}
QPushButton:disabled {{
    color:      {TEXT_DISABLED};
    background: rgba(250, 249, 247, 0.8);
    border-color: {BORDER};
}}

/* ═══════════════════════════════════════════
   ETIQUETAS
═══════════════════════════════════════════ */
QLabel {{ background: transparent; color: {TEXT_BODY}; }}

/* ═══════════════════════════════════════════
   RADIO / CHECK
═══════════════════════════════════════════ */
QRadioButton, QCheckBox {{
    color:      {TEXT_BODY};
    background: transparent;
    spacing:    {SPACE_1 - 1}px;
}}
QRadioButton:focus, QCheckBox:focus {{
    color: {PRIMARY};
}}
QRadioButton::indicator {{
    width: 16px; height: 16px;
    border: 1.5px solid {BORDER_MED};
    border-radius: 8px;
    background: {BG_CONTENT};
}}
QRadioButton::indicator:checked {{
    background:   {PRIMARY};
    border-color: {PRIMARY_HOVER};
}}
QCheckBox::indicator {{
    width: 16px; height: 16px;
    border: 1.5px solid {BORDER_MED};
    border-radius: {RADIUS_SM}px;
    background: {BG_CONTENT};
}}
QCheckBox::indicator:checked {{
    background:   {PRIMARY};
    border-color: {PRIMARY_HOVER};
}}

/* ═══════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════ */
QStatusBar {{
    background: {BG_SHELL};
    color:      {TEXT_MUTED};
    border-top: none;
    font-size:  7.5pt;
    padding-left: {SPACE_2}px;
    min-height: 22px;
}}
QStatusBar::item {{ border: none; }}

/* ═══════════════════════════════════════════
   TOOLTIP
═══════════════════════════════════════════ */
QToolTip {{
    background:    {TEXT_STRONG};
    color:         #F5F5F5;
    border:        1px solid #2A2A2A;
    border-radius: {RADIUS_SM}px;
    padding:       {SPACE_HALF}px {SPACE_1}px;
    font-size:     8pt;
}}

/* ═══════════════════════════════════════════
   FRAME / SEPARADORES
═══════════════════════════════════════════ */
QFrame[frameShape="4"] {{ color: {BORDER}; }}
QFrame[frameShape="5"] {{ color: {BORDER}; }}
"""
