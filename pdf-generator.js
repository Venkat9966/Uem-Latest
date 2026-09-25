import PDFDocument from 'pdfkit';
import { INITIAL_COURSE_CATALOG } from './courses-data.js';

/**
 * Generate a beautifully formatted enterprise PDF lab manual or blueprint for a given module.
 * @param {Object} options
 * @param {Object} options.course
 * @param {Object} options.lesson
 * @param {string} options.type - 'manual' | 'blueprint' | 'summary'
 * @returns {Promise<Buffer>}
 */
export function generateModulePdfBuffer({ course, lesson, type = 'manual' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${lesson.name} - ${type === 'blueprint' ? 'Architecture Blueprints' : 'Lab Manual'}`,
          Author: 'UEM Labs Academy',
          Subject: course.name,
          Keywords: 'UEM, Enterprise, Endpoint, Lab Manual, Architecture'
        }
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#14231f';
      const accentColor = '#2563eb';
      const textColor = '#1f2937';
      const mutedColor = '#4b5563';
      const lightBg = '#f3f4f6';

      // ==========================================
      // HEADER BAR
      // ==========================================
      doc.rect(50, 45, 495, 4).fill(accentColor);
      doc.moveDown(0.8);

      // Organization / Brand
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(accentColor)
        .text('UEM LABS ACADEMY · ENTERPRISE ENDPOINT CERTIFICATION', { characterSpacing: 1 });

      doc.moveDown(0.3);

      // Course Name
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(primaryColor)
        .text(course.name || 'Enterprise Mobility Course');

      // Module Name
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(textColor)
        .text(lesson.name || 'Lesson Module');

      doc.moveDown(0.2);

      // Meta Info line
      const duration = lesson.duration || '45 mins';
      const instructor = course.instructor || 'Lead UEM Solutions Architect';
      const docTypeLabel = type === 'blueprint' ? 'TECHNICAL ARCHITECTURE & PAYLOAD BLUEPRINT' : 'OFFICIAL LAB MANUAL & STUDY GUIDE';

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(mutedColor)
        .text(`Document Type: ${docTypeLabel}   |   Duration: ${duration}   |   Instructor: ${instructor}   |   Verified: Active`);

      doc.moveDown(0.8);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      const details = lesson.details || {};

      // ==========================================
      // SECTION 1: ARCHITECTURE OVERVIEW & CONTEXT
      // ==========================================
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(primaryColor)
        .text('1. Architectural Concept & Core Context');

      doc.moveDown(0.3);

      const overviewText = details.overview || lesson.summary || 'Enterprise mobility policies enforce device boundary isolation, identity federation, and automated configuration.';
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text(overviewText, { lineGap: 3, align: 'justify' });

      doc.moveDown(0.8);

      // ==========================================
      // SECTION 2: CORE KNOWLEDGE TOPICS
      // ==========================================
      if (details.topics && details.topics.length > 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(primaryColor)
          .text('2. Key Learning Topics & Principles');

        doc.moveDown(0.3);

        details.topics.forEach((topic, idx) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(accentColor)
            .text(`  •  `, { continued: true })
            .font('Helvetica')
            .fillColor(textColor)
            .text(topic, { lineGap: 2 });
        });

        doc.moveDown(0.8);
      }

      // ==========================================
      // SECTION 3: STEP-BY-STEP LAB WALKTHROUGH
      // ==========================================
      if (details.lab_guide && details.lab_guide.length > 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(primaryColor)
          .text('3. Step-by-Step Hands-on Lab Procedures');

        doc.moveDown(0.3);

        details.lab_guide.forEach((step, sIdx) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#065f46')
            .text(`[Step ${sIdx + 1}] `, { continued: true })
            .font('Helvetica')
            .fontSize(9.5)
            .fillColor(textColor)
            .text(step, { lineGap: 2 });
          doc.moveDown(0.2);
        });

        doc.moveDown(0.6);
      }

      // ==========================================
      // SECTION 4: CODE / CONFIGURATION PAYLOAD
      // ==========================================
      if (details.commands_configs) {
        if (doc.y > 640) {
          doc.addPage();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(primaryColor)
          .text('4. Production Configurations & Payload Blueprint');

        doc.moveDown(0.4);

        const codeY = doc.y;
        const codeText = details.commands_configs;
        const textHeight = doc.heightOfString(codeText, { width: 470, font: 'Courier', size: 8 });

        doc.rect(50, codeY, 495, textHeight + 16).fill('#1e293b');

        doc
          .font('Courier')
          .fontSize(8)
          .fillColor('#f8fafc')
          .text(codeText, 60, codeY + 8, { width: 475, lineGap: 2 });

        doc.y = codeY + textHeight + 24;
        doc.moveDown(0.6);
      }

      // ==========================================
      // SECTION 5: BEST PRACTICES & KEY TAKEAWAYS
      // ==========================================
      if (details.key_takeaways && details.key_takeaways.length > 0) {
        if (doc.y > 670) {
          doc.addPage();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(primaryColor)
          .text('5. Enterprise Best Practices & Key Takeaways');

        doc.moveDown(0.3);

        details.key_takeaways.forEach((takeaway) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#0284c7')
            .text(`  ✓  `, { continued: true })
            .font('Helvetica')
            .fillColor(textColor)
            .text(takeaway, { lineGap: 2 });
        });

        doc.moveDown(0.8);
      }

      // ==========================================
      // SECTION 6: MANDATORY QUIZ PREPARATION
      // ==========================================
      if (Array.isArray(lesson.quiz) && lesson.quiz.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(primaryColor)
          .text('6. Module Assessment Knowledge Check');

        doc.moveDown(0.2);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(mutedColor)
          .text('Review these knowledge check items before attempting the online mandatory assessment (Passing grade: 70%+):');

        doc.moveDown(0.4);

        lesson.quiz.forEach((q, qIdx) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(textColor)
            .text(`Q${qIdx + 1}: ${q.question}`);

          q.options.forEach((opt, oIdx) => {
            const isCorrect = oIdx === q.answer;
            doc
              .font(isCorrect ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.5)
              .fillColor(isCorrect ? '#15803d' : '#6b7280')
              .text(`     [${String.fromCharCode(65 + oIdx)}] ${opt}${isCorrect ? ' (Correct Answer)' : ''}`);
          });

          if (q.explanation) {
            doc
              .font('Helvetica-Oblique')
              .fontSize(8)
              .fillColor('#4b5563')
              .text(`     Rationale: ${q.explanation}`, { lineGap: 1 });
          }

          doc.moveDown(0.4);
        });
      }

      // ==========================================
      // FOOTER
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#9ca3af')
          .text(
            `UEM Labs Academy  •  ${course.name}  •  ${lesson.name}  •  Page ${i + 1} of ${range.count}`,
            50,
            785,
            { align: 'center', width: 495 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
