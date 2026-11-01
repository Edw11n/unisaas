import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session.dart';
import '../../pos/presentation/pos_screen.dart';

class MobileDashboardScreen extends ConsumerStatefulWidget {
  const MobileDashboardScreen({super.key});

  @override
  ConsumerState<MobileDashboardScreen> createState() =>
      _MobileDashboardScreenState();
}

class _MobileDashboardScreenState extends ConsumerState<MobileDashboardScreen> {
  int _selectedTabIndex = 0;
  String _selectedTimeframe = 'Semana'; // Hoy, Semana, Mes
  bool _isDarkMode = false;

  final List<_ChartDayData> _weekData = [
    _ChartDayData(day: 'Lun', leftValue: 60, rightValue: 80),
    _ChartDayData(day: 'Mar', leftValue: 60, rightValue: 80),
    _ChartDayData(day: 'Mie', leftValue: 40, rightValue: 68),
    _ChartDayData(day: 'Jue', leftValue: 40, rightValue: 68),
    _ChartDayData(day: 'Vie', leftValue: 60, rightValue: 26),
    _ChartDayData(
        day: 'Sab',
        leftValue: 48,
        rightValue: 60,
        tooltip: '\$ 1.525.000',
        hasTooltip: true),
    _ChartDayData(day: 'Dom', leftValue: 52, rightValue: 60),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Barra Superior: Logo UNISAAS y Switch de Tema
              _buildTopHeader(),

              const SizedBox(height: 16),

              // 2. Buscador Redondeado
              _buildSearchBar(),

              const SizedBox(height: 18),

              // 3. Grid 2x2 de Metricas (KPIs Operativos Reales)
              _buildKpiGrid(),

              const SizedBox(height: 24),

              // 4. Seccion del Grafico: Titulo y Selector de Periodo
              _buildChartHeader(),

              const SizedBox(height: 16),

              // 5. Grafico de Barras Dobles con Escala Y y Tooltip
              _buildDualBarChart(),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),

      // 6. Barra de Navegacion Inferior con 5 Destinos
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  // 1. Header con Logo y Switch
  Widget _buildTopHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF0066FF),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.storefront,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'UNISAAS',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E293B),
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        // Toggle de Tema
        Row(
          children: [
            IconButton(
              onPressed: _handleLogout,
              tooltip: 'Cerrar sesion',
              icon: const Icon(
                Icons.logout_rounded,
                size: 20,
                color: Color(0xFF5A6484),
              ),
            ),
            GestureDetector(
              onTap: () => setState(() => _isDarkMode = !_isDarkMode),
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F6F8),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: !_isDarkMode ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: !_isDarkMode
                            ? [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                )
                              ]
                            : null,
                      ),
                      child: const Icon(
                        Icons.wb_sunny_outlined,
                        size: 16,
                        color: Color(0xFF0066FF),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: _isDarkMode ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.nightlight_outlined,
                        size: 16,
                        color: Color(0xFF8A92A6),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _handleLogout() async {
    ref.read(authSessionProvider.notifier).end();
    await SessionStore.clear();
  }

  // 2. Buscador Minimalista
  Widget _buildSearchBar() {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: const Row(
        children: [
          Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Buscar productos, ventas o clientes...',
                hintStyle: TextStyle(
                  color: Color(0xFF8A92A6),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          Icon(
            Icons.search,
            color: Color(0xFF5A6484),
            size: 22,
          ),
        ],
      ),
    );
  }

  // 3. Grid 2x2 de KPIs Operativos
  Widget _buildKpiGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.55,
      children: [
        // KPI 1: Ventas Hoy
        _buildKpiCard(
          icon: Icons.point_of_sale,
          number: '\$ 1.25M',
          label: 'Ventas de Hoy',
          isUpTrend: true,
        ),
        // KPI 2: Cobrado en Caja
        _buildKpiCard(
          icon: Icons.payments_outlined,
          number: '\$ 980k',
          label: 'Cobrado en Caja',
          isUpTrend: true,
        ),
        // KPI 3: Cartera / Fiado
        _buildKpiCard(
          icon: Icons.credit_card_outlined,
          number: '\$ 270k',
          label: 'Cartera (Fiado)',
          isUpTrend: false,
        ),
        // KPI 4: Stock Bajo
        _buildKpiCard(
          icon: Icons.warning_amber_rounded,
          number: '4 Art.',
          label: 'Bajo Minimo',
          isUpTrend: false,
        ),
      ],
    );
  }

  Widget _buildKpiCard({
    required IconData icon,
    required String number,
    required String label,
    required bool isUpTrend,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Icono con Borde Suave
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFFE2E4E9),
                    width: 1,
                  ),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: const Color(0xFF0066FF),
                ),
              ),

              // Cifra Numerica
              Text(
                number,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B),
                  letterSpacing: -0.5,
                ),
              ),

              // Badge de Tendencia
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isUpTrend
                      ? const Color(0xFFE6F9F0)
                      : const Color(0xFFFDECEE),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isUpTrend ? Icons.trending_up : Icons.trending_down,
                  size: 14,
                  color: isUpTrend
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                ),
              ),
            ],
          ),

          // Texto Inferior
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF5A6484),
            ),
          ),
        ],
      ),
    );
  }

  // 4. Header del Grafico y Segmented Control
  Widget _buildChartHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Expanded(
          child: Text(
            'Ventas del Periodo',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1E293B),
              letterSpacing: -0.5,
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Pill Switcher de Periodo
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTimeframePill('Hoy'),
              _buildTimeframePill('Semana'),
              _buildTimeframePill('Mes'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTimeframePill(String label) {
    final isSelected = _selectedTimeframe == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedTimeframe = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color:
                isSelected ? const Color(0xFF0066FF) : const Color(0xFF8A92A6),
          ),
        ),
      ),
    );
  }

  // 5. Grafico de Barras Dobles
  Widget _buildDualBarChart() {
    return SizedBox(
      height: 240,
      child: Stack(
        children: [
          // Escala Y y Lineas de Guia
          Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildYAxisLabel('2.0M'),
              _buildYAxisLabel('1.5M'),
              _buildYAxisLabel('1.0M'),
              _buildYAxisLabel('0.5M'),
              _buildYAxisLabel('\$ 0'),
            ],
          ),

          // Contenedor de Barras
          Positioned(
            left: 44,
            right: 0,
            top: 6,
            bottom: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.end,
              children:
                  _weekData.map((data) => _buildDayBarGroup(data)).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildYAxisLabel(String text) {
    return Row(
      children: [
        SizedBox(
          width: 36,
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFF8A92A6),
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 1,
            color: const Color(0xFFF1F3F5),
          ),
        ),
      ],
    );
  }

  Widget _buildDayBarGroup(_ChartDayData data) {
    const double maxBarHeight = 160.0;
    final double leftHeight = (data.leftValue / 80.0) * maxBarHeight;
    final double rightHeight = (data.rightValue / 80.0) * maxBarHeight;

    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        // Tooltip Flotante
        if (data.hasTooltip) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E4E9), width: 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              data.tooltip ?? '',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
          const SizedBox(height: 4),
        ] else ...[
          const SizedBox(height: 28),
        ],

        // Par de Barras Dobles
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Barra Azul Primaria (Izquierda)
            Container(
              width: 10,
              height: leftHeight,
              decoration: const BoxDecoration(
                color: Color(0xFF0066FF),
                borderRadius: BorderRadius.vertical(top: Radius.circular(3)),
              ),
            ),
            const SizedBox(width: 3),
            // Barra Celeste (Derecha)
            Container(
              width: 10,
              height: rightHeight,
              decoration: const BoxDecoration(
                color: Color(0xFF8EB5F8),
                borderRadius: BorderRadius.vertical(top: Radius.circular(3)),
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // Nombre del Dia
        Text(
          data.day,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF8A92A6),
          ),
        ),
      ],
    );
  }

  // 6. Barra de Navegacion Inferior con 5 Iconos
  Widget _buildBottomNavBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(
            color: Color(0xFFF1F3F5),
            width: 1,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(0, Icons.home_outlined, 'Inicio', () {}),
          _buildNavItem(1, Icons.storefront_outlined, 'Vender POS', () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MobilePosScreen()),
            );
          }),
          _buildNavItem(2, Icons.receipt_long_outlined, 'Ventas', () {}),
          _buildNavItem(3, Icons.people_outline, 'Clientes', () {}),
          _buildNavItem(4, Icons.settings_outlined, 'Ajustes', () {}),
        ],
      ),
    );
  }

  Widget _buildNavItem(
      int index, IconData icon, String label, VoidCallback onTap) {
    final isSelected = _selectedTabIndex == index;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedTabIndex = index);
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 24,
            color:
                isSelected ? const Color(0xFF0066FF) : const Color(0xFF8A92A6),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color: isSelected
                  ? const Color(0xFF0066FF)
                  : const Color(0xFF8A92A6),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartDayData {
  final String day;
  final double leftValue;
  final double rightValue;
  final String? tooltip;
  final bool hasTooltip;

  _ChartDayData({
    required this.day,
    required this.leftValue,
    required this.rightValue,
    this.tooltip,
    this.hasTooltip = false,
  });
}
